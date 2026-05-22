const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAnomalyIfNeeded } = require("../../utils/anomaly");
const { createAuditLog } = require("../../utils/auditLog");
const {
  assertSppgOwnership,
  requireSppgScope
} = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const foodPriceService = require("../foodPrices/service");

const prisma = getPrismaClient();

const batchInclude = {
  sppg: true,
  menu: true,
  items: {
    include: {
      sourceFoodPrice: true
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  anomalyLogs: {
    orderBy: {
      createdAt: "desc"
    }
  }
};

const startOfDate = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const toNumber = (value) => Number(value || 0);

const normalizeRows = foodPriceService.normalizeRows;

const readConfigNumber = async ({ client = prisma, key, fallback }) => {
  const config = await client.systemConfig.findUnique({
    where: {
      key
    }
  });
  const value = config?.value;

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && Number.isFinite(Number(value))) {
    return Number(value);
  }

  if (value && typeof value === "object" && Number.isFinite(Number(value.value))) {
    return Number(value.value);
  }

  return fallback;
};

const buildBatchWhere = ({ query = {}, user }) => {
  const where = {
    sppg: {
      deletedAt: null
    },
    ...(query.sppgId ? { sppgId: Number(query.sppgId) } : {}),
    ...(query.date ? { productionDate: startOfDate(query.date) } : {}),
    ...(query.province
      ? {
          sppg: {
            deletedAt: null,
            province: {
              contains: query.province,
              mode: "insensitive"
            }
          }
        }
      : {})
  };

  if (user.role === "sppg") {
    where.sppgId = requireSppgScope(user);
  }

  return where;
};

const getBatchById = async ({ id, client = prisma }) => {
  const batch = await client.productionBatch.findUnique({
    where: {
      id: Number(id)
    },
    include: batchInclude
  });

  if (!batch) {
    throw new AppError("Production batch not found.", 404, "PRODUCTION_BATCH_NOT_FOUND");
  }

  return batch;
};

const ensureBatchAccess = (user, batch) => {
  if (user.role === "sppg") {
    assertSppgOwnership(user, batch.sppgId);
  }
};

const attachLatestFoodPrice = async ({ batchItem, batch, client = prisma }) => {
  const marketPrice = await foodPriceService.findLatestMarketPrice({
    province: batch.sppg.province,
    variantId: batchItem.variantId,
    commodityName: batchItem.commodityName,
    client
  });

  if (!marketPrice) {
    return {
      ...batchItem,
      sourcePrice: null,
      sourcePriceId: null,
      marketReferencePrice: null,
      priceDifferencePercent: null
    };
  }

  const inputPrice = toNumber(batchItem.unitPrice);
  const referencePrice = toNumber(marketPrice.price);
  const priceDifferencePercent = referencePrice > 0
    ? Number((((inputPrice - referencePrice) / referencePrice) * 100).toFixed(2))
    : null;

  return {
    ...batchItem,
    sourcePrice: marketPrice.source,
    sourcePriceId: marketPrice.id,
    marketReferencePrice: referencePrice,
    priceDifferencePercent
  };
};

const compareWithMarketPrice = async ({ batchItem, batch, client = prisma }) =>
  attachLatestFoodPrice({
    batchItem,
    batch,
    client
  });

const checkRawMaterialPriceAnomaly = async ({ batchItem, batch, actorUserId = null, ipAddress = null, client = prisma }) => {
  if (!batchItem.marketReferencePrice || batchItem.priceDifferencePercent === null) {
    return {
      checked: false
    };
  }

  const thresholdPercent = await readConfigNumber({
    client,
    key: "raw_material_price_anomaly_percent",
    fallback: 25
  });

  if (Number(batchItem.priceDifferencePercent) <= thresholdPercent) {
    await client.anomalyLog.updateMany({
      where: {
        productionBatchItemId: batchItem.id,
        anomalyType: "RAW_MATERIAL_PRICE_ANOMALY",
        isResolved: false
      },
      data: {
        isResolved: true,
        resolvedBy: actorUserId,
        resolvedAt: new Date()
      }
    });

    return {
      checked: true,
      created: false
    };
  }

  return createAnomalyIfNeeded({
    prisma: client,
    productionBatchId: batch.id,
    productionBatchItemId: batchItem.id,
    anomalyType: "RAW_MATERIAL_PRICE_ANOMALY",
    description: `Harga bahan baku ${batchItem.commodityName} Rp ${toNumber(batchItem.unitPrice).toLocaleString("id-ID")} lebih tinggi ${Number(batchItem.priceDifferencePercent).toFixed(2)}% dari referensi pasar ${batch.sppg.province}.`,
    metadata: {
      commodity_name: batchItem.commodityName,
      market_price: toNumber(batchItem.marketReferencePrice),
      input_price: toNumber(batchItem.unitPrice),
      selisih_percent: Number(batchItem.priceDifferencePercent),
      province: batch.sppg.province,
      production_batch_id: batch.id
    },
    actorUserId,
    ipAddress
  });
};

const calculateProductionBatchCost = async ({ batchId, client = prisma }) => {
  const batch = await client.productionBatch.findUnique({
    where: {
      id: Number(batchId)
    },
    include: {
      items: true
    }
  });

  if (!batch) {
    throw new AppError("Production batch not found.", 404, "PRODUCTION_BATCH_NOT_FOUND");
  }

  const rawMaterialCost = batch.items.reduce((sum, item) => sum + toNumber(item.totalPrice), 0);
  const totalCost =
    rawMaterialCost +
    toNumber(batch.operationalCost) +
    toNumber(batch.packagingCost) +
    toNumber(batch.distributionCost);
  const costPerPortion = batch.totalPortions > 0 ? totalCost / batch.totalPortions : 0;

  const updated = await client.productionBatch.update({
    where: {
      id: batch.id
    },
    data: {
      rawMaterialCost,
      totalCost,
      costPerPortion: Number(costPerPortion.toFixed(2))
    },
    include: batchInclude
  });

  return updated;
};

const calculateCostPerPortion = async ({ batchId, client = prisma }) => {
  const batch = await calculateProductionBatchCost({
    batchId,
    client
  });

  return Number(batch.costPerPortion);
};

const listProductionBatches = async ({ query = {}, user }) => {
  const pagination = parsePagination(query);
  const where = buildBatchWhere({
    query,
    user
  });

  const [items, total] = await Promise.all([
    prisma.productionBatch.findMany({
      where,
      include: {
        sppg: true,
        menu: true,
        _count: {
          select: {
            items: true,
            anomalyLogs: true
          }
        }
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ productionDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.productionBatch.count({ where })
  ]);

  return {
    data: normalizeRows(items),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getProductionBatchDetail = async ({ id, user }) => {
  const batch = await getBatchById({ id });
  ensureBatchAccess(user, batch);

  return {
    data: normalizeRows([batch])[0]
  };
};

const createProductionBatch = async ({ payload, user, ipAddress }) => {
  const targetSppgId = user.role === "sppg" ? requireSppgScope(user) : payload.sppgId;

  if (!targetSppgId) {
    throw new AppError("sppgId is required.", 400, "SPPG_ID_REQUIRED");
  }

  assertSppgOwnership(user, targetSppgId);

  const created = await prisma.$transaction(async (tx) => {
    const batch = await tx.productionBatch.create({
      data: {
        sppgId: targetSppgId,
        menuId: payload.menuId ?? null,
        productionDate: startOfDate(payload.productionDate),
        totalPortions: payload.totalPortions,
        operationalCost: payload.operationalCost ?? 0,
        packagingCost: payload.packagingCost ?? 0,
        distributionCost: payload.distributionCost ?? 0,
        notes: payload.notes ?? null
      }
    });

    const recalculated = await calculateProductionBatchCost({
      batchId: batch.id,
      client: tx
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "production_batches",
      recordId: recalculated.id,
      newData: recalculated,
      ipAddress
    });

    return recalculated;
  });

  return {
    data: normalizeRows([created])[0]
  };
};

const updateProductionBatch = async ({ id, payload, user, ipAddress }) => {
  const existing = await getBatchById({ id });
  ensureBatchAccess(user, existing);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.productionBatch.update({
      where: {
        id: existing.id
      },
      data: {
        ...(payload.menuId !== undefined ? { menuId: payload.menuId } : {}),
        ...(payload.productionDate !== undefined ? { productionDate: startOfDate(payload.productionDate) } : {}),
        ...(payload.totalPortions !== undefined ? { totalPortions: payload.totalPortions } : {}),
        ...(payload.operationalCost !== undefined ? { operationalCost: payload.operationalCost } : {}),
        ...(payload.packagingCost !== undefined ? { packagingCost: payload.packagingCost } : {}),
        ...(payload.distributionCost !== undefined ? { distributionCost: payload.distributionCost } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {})
      }
    });

    const recalculated = await calculateProductionBatchCost({
      batchId: saved.id,
      client: tx
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "production_batches",
      recordId: recalculated.id,
      oldData: existing,
      newData: recalculated,
      ipAddress
    });

    return recalculated;
  });

  return {
    data: normalizeRows([updated])[0]
  };
};

const deleteProductionBatch = async ({ id, user, ipAddress }) => {
  const existing = await getBatchById({ id });
  ensureBatchAccess(user, existing);

  await prisma.$transaction(async (tx) => {
    await tx.productionBatch.delete({
      where: {
        id: existing.id
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "DELETE",
      tableName: "production_batches",
      recordId: existing.id,
      oldData: existing,
      ipAddress
    });
  });

  return {
    data: {
      id: existing.id
    }
  };
};

const addProductionBatchItem = async ({ batchId, payload, user, ipAddress }) => {
  const batch = await getBatchById({ id: batchId });
  ensureBatchAccess(user, batch);

  const result = await prisma.$transaction(async (tx) => {
    const totalPrice = Number((payload.quantity * payload.unitPrice).toFixed(2));
    const itemDraft = {
      productionBatchId: batch.id,
      commodityName: payload.commodityName,
      variantId: payload.variantId ?? null,
      quantity: payload.quantity,
      unit: payload.unit,
      unitPrice: payload.unitPrice,
      totalPrice
    };
    const itemWithMarket = await compareWithMarketPrice({
      batchItem: itemDraft,
      batch,
      client: tx
    });
    const item = await tx.productionBatchItem.create({
      data: itemWithMarket
    });
    const refreshedBatch = await getBatchById({
      id: batch.id,
      client: tx
    });

    await checkRawMaterialPriceAnomaly({
      batchItem: item,
      batch: refreshedBatch,
      actorUserId: user.userId,
      ipAddress,
      client: tx
    });

    await calculateProductionBatchCost({
      batchId: batch.id,
      client: tx
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "production_batch_items",
      recordId: item.id,
      newData: item,
      ipAddress
    });

    return tx.productionBatchItem.findUnique({
      where: {
        id: item.id
      },
      include: {
        sourceFoodPrice: true
      }
    });
  });

  return {
    data: normalizeRows([result])[0]
  };
};

const updateProductionBatchItem = async ({ id, payload, user, ipAddress }) => {
  const existing = await prisma.productionBatchItem.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      productionBatch: {
        include: {
          sppg: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError("Production batch item not found.", 404, "PRODUCTION_BATCH_ITEM_NOT_FOUND");
  }

  ensureBatchAccess(user, existing.productionBatch);

  const result = await prisma.$transaction(async (tx) => {
    const nextQuantity = payload.quantity ?? existing.quantity;
    const nextUnitPrice = payload.unitPrice ?? toNumber(existing.unitPrice);
    const itemDraft = {
      ...existing,
      commodityName: payload.commodityName ?? existing.commodityName,
      variantId: payload.variantId !== undefined ? payload.variantId : existing.variantId,
      quantity: nextQuantity,
      unit: payload.unit ?? existing.unit,
      unitPrice: nextUnitPrice,
      totalPrice: Number((nextQuantity * nextUnitPrice).toFixed(2))
    };
    const batch = await getBatchById({
      id: existing.productionBatchId,
      client: tx
    });
    const itemWithMarket = await compareWithMarketPrice({
      batchItem: itemDraft,
      batch,
      client: tx
    });
    const updated = await tx.productionBatchItem.update({
      where: {
        id: existing.id
      },
      data: {
        commodityName: itemWithMarket.commodityName,
        variantId: itemWithMarket.variantId,
        quantity: itemWithMarket.quantity,
        unit: itemWithMarket.unit,
        unitPrice: itemWithMarket.unitPrice,
        totalPrice: itemWithMarket.totalPrice,
        sourcePrice: itemWithMarket.sourcePrice,
        sourcePriceId: itemWithMarket.sourcePriceId,
        marketReferencePrice: itemWithMarket.marketReferencePrice,
        priceDifferencePercent: itemWithMarket.priceDifferencePercent
      },
      include: {
        sourceFoodPrice: true
      }
    });

    await checkRawMaterialPriceAnomaly({
      batchItem: updated,
      batch,
      actorUserId: user.userId,
      ipAddress,
      client: tx
    });

    await calculateProductionBatchCost({
      batchId: existing.productionBatchId,
      client: tx
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "production_batch_items",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: normalizeRows([result])[0]
  };
};

const deleteProductionBatchItem = async ({ id, user, ipAddress }) => {
  const existing = await prisma.productionBatchItem.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      productionBatch: true
    }
  });

  if (!existing) {
    throw new AppError("Production batch item not found.", 404, "PRODUCTION_BATCH_ITEM_NOT_FOUND");
  }

  ensureBatchAccess(user, existing.productionBatch);

  await prisma.$transaction(async (tx) => {
    await tx.productionBatchItem.delete({
      where: {
        id: existing.id
      }
    });

    await calculateProductionBatchCost({
      batchId: existing.productionBatchId,
      client: tx
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "DELETE",
      tableName: "production_batch_items",
      recordId: existing.id,
      oldData: existing,
      ipAddress
    });
  });

  return {
    data: {
      id: existing.id
    }
  };
};

const getCostSummary = async ({ id, user }) => {
  const batch = await calculateProductionBatchCost({
    batchId: id
  });
  ensureBatchAccess(user, batch);

  return {
    data: {
      rawMaterialCost: Number(batch.rawMaterialCost),
      operationalCost: Number(batch.operationalCost),
      packagingCost: Number(batch.packagingCost),
      distributionCost: Number(batch.distributionCost),
      totalCost: Number(batch.totalCost),
      totalPortions: batch.totalPortions,
      costPerPortion: Number(batch.costPerPortion)
    }
  };
};

const getBatchAnomalies = async ({ id, user }) => {
  const batch = await getBatchById({ id });
  ensureBatchAccess(user, batch);

  const anomalies = await prisma.anomalyLog.findMany({
    where: {
      OR: [
        {
          productionBatchId: batch.id
        },
        {
          productionBatchItem: {
            productionBatchId: batch.id
          }
        }
      ]
    },
    include: {
      productionBatchItem: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return {
    data: normalizeRows(anomalies)
  };
};

const findBatchForDistribution = async ({ sppgId, distributionDate, productionBatchId, client = prisma }) => {
  if (productionBatchId) {
    return client.productionBatch.findFirst({
      where: {
        id: Number(productionBatchId),
        sppgId: Number(sppgId)
      }
    });
  }

  return client.productionBatch.findFirst({
    where: {
      sppgId: Number(sppgId),
      productionDate: startOfDate(distributionDate),
      costPerPortion: {
        gt: 0
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
};

module.exports = {
  addProductionBatchItem,
  attachLatestFoodPrice,
  calculateCostPerPortion,
  calculateProductionBatchCost,
  checkRawMaterialPriceAnomaly,
  compareWithMarketPrice,
  createProductionBatch,
  deleteProductionBatch,
  deleteProductionBatchItem,
  findBatchForDistribution,
  getBatchAnomalies,
  getCostSummary,
  getProductionBatchDetail,
  listProductionBatches,
  updateProductionBatch,
  updateProductionBatchItem
};
