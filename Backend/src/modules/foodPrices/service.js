const { getPrismaClient } = require("../../config/prisma");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const { startOfDayUtc } = require("../../utils/date");

const prisma = getPrismaClient();

const DEFAULT_COSTS = {
  packaging: 1000,
  operational: 1500,
  distribution: 1000,
  minMultiplier: 0.85,
  maxMultiplier: 1.25
};

const COMPONENTS = {
  rice: {
    quantity: 0.15,
    labels: ["beras medium", "beras premium", "beras"]
  },
  chicken: {
    quantity: 0.1,
    labels: ["daging ayam ras", "ayam ras", "daging ayam"]
  },
  egg: {
    quantity: 0.05,
    labels: ["telur ayam ras", "telur ayam"]
  },
  vegetable: {
    quantity: 0.08,
    labels: ["kangkung", "sawi hijau", "buncis", "bayam", "sayur"]
  },
  oil: {
    quantity: 0.02,
    labels: ["minyakita", "minyak goreng"]
  }
};

const normalizeValue = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    if (typeof value.toJSON === "function" && value.constructor?.name !== "Object") {
      return normalizeValue(value.toJSON());
    }

    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      accumulator[key] = normalizeValue(nestedValue);
      return accumulator;
    }, {});
  }

  return value;
};

const normalizeRows = (rows) => rows.map((row) => normalizeValue(row));

const buildFoodPriceWhere = (query = {}) => ({
  ...(query.date ? { date: startOfDayUtc(query.date) } : {}),
  ...(query.province
    ? {
        province: {
          contains: query.province,
          mode: "insensitive"
        }
      }
    : {}),
  ...(query.city
    ? {
        city: {
          contains: query.city,
          mode: "insensitive"
        }
      }
    : {}),
  ...(query.variant
    ? {
        variant: {
          contains: query.variant,
          mode: "insensitive"
        }
      }
    : {}),
  ...(query.scope ? { scope: query.scope } : {})
});

const getLatestDate = async ({ client = prisma, where = {} } = {}) => {
  const result = await client.foodPrice.aggregate({
    where,
    _max: {
      date: true
    }
  });

  return result._max.date;
};

const listFoodPrices = async ({ query = {} }) => {
  const pagination = parsePagination(query);
  const where = buildFoodPriceWhere(query);

  if (query.latest === true || query.latest === "true") {
    const latestDate = await getLatestDate({ where });

    if (latestDate) {
      where.date = latestDate;
    }
  }

  const [items, total] = await Promise.all([
    prisma.foodPrice.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ date: "desc" }, { province: "asc" }, { city: "asc" }, { variant: "asc" }]
    }),
    prisma.foodPrice.count({ where })
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

const getLatestFoodPrices = async ({ query = {}, client = prisma } = {}) => {
  const where = buildFoodPriceWhere(query);
  const latestDate = await getLatestDate({
    client,
    where
  });

  if (!latestDate) {
    return {
      data: [],
      meta: {
        sourceDate: null
      }
    };
  }

  const rows = await client.foodPrice.findMany({
    where: {
      ...where,
      date: latestDate
    },
    orderBy: [{ province: "asc" }, { city: "asc" }, { variant: "asc" }]
  });

  return {
    data: normalizeRows(rows),
    meta: {
      sourceDate: latestDate.toISOString().slice(0, 10)
    }
  };
};

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

  if (value && typeof value === "object") {
    const nested = value.value ?? value.amount ?? value.default;
    if (Number.isFinite(Number(nested))) {
      return Number(nested);
    }
  }

  return fallback;
};

const getCostConfig = async ({ client = prisma } = {}) => {
  const [packaging, operational, distribution, minMultiplier, maxMultiplier] = await Promise.all([
    readConfigNumber({ client, key: "mbg_packaging_cost", fallback: DEFAULT_COSTS.packaging }),
    readConfigNumber({ client, key: "mbg_operational_cost", fallback: DEFAULT_COSTS.operational }),
    readConfigNumber({ client, key: "mbg_distribution_cost", fallback: DEFAULT_COSTS.distribution }),
    readConfigNumber({
      client,
      key: "mbg_threshold_min_multiplier",
      fallback: DEFAULT_COSTS.minMultiplier
    }),
    readConfigNumber({
      client,
      key: "mbg_threshold_max_multiplier",
      fallback: DEFAULT_COSTS.maxMultiplier
    })
  ]);

  return {
    packaging,
    operational,
    distribution,
    minMultiplier,
    maxMultiplier
  };
};

const getThresholdWeightConfig = async ({ client = prisma } = {}) => {
  const [actualWeight, estimateWeight] = await Promise.all([
    readConfigNumber({
      client,
      key: "mbg_threshold_actual_cost_weight",
      fallback: 0.7
    }),
    readConfigNumber({
      client,
      key: "mbg_threshold_food_price_estimate_weight",
      fallback: 0.3
    })
  ]);

  return {
    actualWeight,
    estimateWeight
  };
};

const findLatestRowsForRegion = async ({ client = prisma, province, scope }) => {
  const baseWhere = {
    scope,
    ...(province
      ? {
          province: {
            equals: province,
            mode: "insensitive"
          }
        }
      : {})
  };
  const latestDate = await getLatestDate({
    client,
    where: baseWhere
  });

  if (!latestDate) {
    return [];
  }

  return client.foodPrice.findMany({
    where: {
      ...baseWhere,
      date: latestDate
    }
  });
};

const pickComponent = ({ rows, labels }) => {
  const loweredRows = rows.map((row) => ({
    row,
    label: row.variant.toLowerCase()
  }));

  for (const label of labels) {
    const match = loweredRows.find(({ label: variantLabel }) => variantLabel.includes(label));
    if (match) {
      return match.row;
    }
  }

  return null;
};

const buildComponentCost = ({ row, quantity }) => {
  if (!row) {
    return {
      variant: null,
      unitPrice: 0,
      quantity,
      cost: 0,
      sourceDate: null,
      missing: true
    };
  }

  const unitPrice = Number(row.price);
  return {
    variant: row.variant,
    unitPrice,
    quantity,
    cost: Number((unitPrice * quantity).toFixed(2)),
    sourceDate: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
    missing: false
  };
};

const calculateEstimatedPortionPrice = async ({ province, client = prisma } = {}) => {
  const [provinceRows, nationalRows, costConfig] = await Promise.all([
    province ? findLatestRowsForRegion({ client, province, scope: "province" }) : Promise.resolve([]),
    findLatestRowsForRegion({ client, scope: "national" }),
    getCostConfig({ client })
  ]);

  const components = Object.entries(COMPONENTS).reduce((accumulator, [key, definition]) => {
    const row =
      pickComponent({
        rows: provinceRows,
        labels: definition.labels
      }) ||
      pickComponent({
        rows: nationalRows,
        labels: definition.labels
      });

    accumulator[key] = buildComponentCost({
      row,
      quantity: definition.quantity
    });
    return accumulator;
  }, {});

  components.packaging = costConfig.packaging;
  components.operational = costConfig.operational;
  components.distribution = costConfig.distribution;

  const variableCost = Object.entries(components)
    .filter(([, value]) => value && typeof value === "object")
    .reduce((sum, [, value]) => sum + value.cost, 0);

  const estimatedPortionPrice = Number(
    (variableCost + costConfig.packaging + costConfig.operational + costConfig.distribution).toFixed(2)
  );

  const sourceDate =
    Object.values(components)
      .filter((value) => value && typeof value === "object" && value.sourceDate)
      .map((value) => value.sourceDate)
      .sort()
      .pop() || null;

  return {
    province: province || null,
    estimatedPortionPrice,
    components,
    sourceDate,
    multipliers: {
      min: costConfig.minMultiplier,
      max: costConfig.maxMultiplier
    }
  };
};

const buildThresholdData = ({ province, estimate, actorUserId = null }) => ({
  province,
  minPrice: Number((estimate.estimatedPortionPrice * estimate.multipliers.min).toFixed(2)),
  maxPrice: Number((estimate.estimatedPortionPrice * estimate.multipliers.max).toFixed(2)),
  avgReferencePrice: estimate.estimatedPortionPrice,
  source: "SP2KP Kemendag",
  generatedFromFoodPrices: true,
  generatedAt: new Date(),
  updatedBy: actorUserId
});

const findLatestMarketPrice = async ({ province, variantId, commodityName, client = prisma } = {}) => {
  const buildBaseWhere = (scope) => ({
    scope,
    ...(scope === "province" && province
      ? {
          province: {
            equals: province,
            mode: "insensitive"
          }
        }
      : {}),
    ...(variantId
      ? {
          variantId: Number(variantId)
        }
      : commodityName
        ? {
            variant: {
              contains: commodityName,
              mode: "insensitive"
            }
          }
        : {})
  });

  for (const scope of ["province", "national"]) {
    const where = buildBaseWhere(scope);
    const latestDate = await getLatestDate({
      client,
      where
    });

    if (!latestDate) {
      continue;
    }

    const row = await client.foodPrice.findFirst({
      where: {
        ...where,
        date: latestDate
      },
      orderBy: {
        variant: "asc"
      }
    });

    if (row) {
      return row;
    }
  }

  return null;
};

const saveGeneratedThreshold = async ({ client = prisma, province, estimate, actorUserId = null }) => {
  const existing = await client.priceThreshold.findFirst({
    where: {
      province: {
        equals: province,
        mode: "insensitive"
      }
    }
  });

  const data = buildThresholdData({
    province,
    estimate,
    actorUserId
  });

  if (existing) {
    const updated = await client.priceThreshold.update({
      where: {
        id: existing.id
      },
      data
    });

    return {
      action: "updated",
      threshold: updated
    };
  }

  try {
    const created = await client.priceThreshold.create({
      data
    });

    return {
      action: "generated",
      threshold: created
    };
  } catch (error) {
    if (error.code !== "P2002") {
      throw error;
    }

    const current = await client.priceThreshold.findFirst({
      where: {
        province: {
          equals: province,
          mode: "insensitive"
        }
      }
    });

    const updated = await client.priceThreshold.update({
      where: {
        id: current.id
      },
      data
    });

    return {
      action: "updated",
      threshold: updated
    };
  }
};

const generatePriceThresholdsFromFoodPrices = async ({ client = prisma, actorUserId = null } = {}) => {
  const latestDate = await getLatestDate({
    client,
    where: {
      scope: "province"
    }
  });

  const provinceRows = latestDate
    ? await client.foodPrice.findMany({
        where: {
          scope: "province",
          date: latestDate,
          province: {
            not: null
          }
        },
        distinct: ["province"],
        select: {
          province: true
        },
        orderBy: {
          province: "asc"
        }
      })
    : [];

  const batchRows = await client.productionBatch.findMany({
    where: {
      costPerPortion: {
        gt: 0
      },
      sppg: {
        deletedAt: null
      }
    },
    include: {
      sppg: {
        select: {
          province: true
        }
      }
    }
  });
  const productionByProvince = batchRows.reduce((accumulator, batch) => {
    const province = batch.sppg?.province;
    if (!province) {
      return accumulator;
    }

    const current = accumulator.get(province) || {
      totalCostPerPortion: 0,
      count: 0
    };
    current.totalCostPerPortion += Number(batch.costPerPortion);
    current.count += 1;
    accumulator.set(province, current);
    return accumulator;
  }, new Map());

  const provinces = new Set([
    ...provinceRows.map((row) => row.province).filter(Boolean),
    ...productionByProvince.keys()
  ]);
  const weightConfig = await getThresholdWeightConfig({ client });
  const costConfig = await getCostConfig({ client });

  const summary = {
    generated: 0,
    updated: 0,
    skipped: 0,
    source: "SP2KP Kemendag",
    sourceDate: latestDate ? latestDate.toISOString().slice(0, 10) : null
  };

  for (const province of provinces) {
    const estimate = await calculateEstimatedPortionPrice({
      province,
      client
    });
    const production = productionByProvince.get(province);
    const actualAvg = production?.count ? production.totalCostPerPortion / production.count : null;

    if (!actualAvg && (!estimate.sourceDate || estimate.estimatedPortionPrice <= 0)) {
      summary.skipped += 1;
      continue;
    }

    let avgReferencePrice = actualAvg || estimate.estimatedPortionPrice;

    if (actualAvg && estimate.sourceDate && estimate.estimatedPortionPrice > 0) {
      const weightTotal = weightConfig.actualWeight + weightConfig.estimateWeight || 1;
      avgReferencePrice = (actualAvg * weightConfig.actualWeight + estimate.estimatedPortionPrice * weightConfig.estimateWeight) / weightTotal;
    }

    const weightedEstimate = {
      ...estimate,
      estimatedPortionPrice: Number(avgReferencePrice.toFixed(2)),
      sourceDate: estimate.sourceDate || (latestDate ? latestDate.toISOString().slice(0, 10) : null),
      multipliers: {
        min: costConfig.minMultiplier,
        max: costConfig.maxMultiplier
      }
    };

    const result = await saveGeneratedThreshold({
      client,
      province,
      estimate: weightedEstimate,
      actorUserId
    });

    summary[result.action] += 1;
  }

  return summary;
};

const ensurePriceThresholdForProvince = async ({ province, client = prisma, actorUserId = null } = {}) => {
  if (!province) {
    return null;
  }

  const existing = await client.priceThreshold.findFirst({
    where: {
      province: {
        equals: province,
        mode: "insensitive"
      }
    }
  });

  if (existing) {
    return existing;
  }

  const estimate = await calculateEstimatedPortionPrice({
    province,
    client
  });

  if (!estimate.sourceDate || estimate.estimatedPortionPrice <= 0) {
    return null;
  }

  const result = await saveGeneratedThreshold({
    client,
    province,
    estimate,
    actorUserId
  });

  return result.threshold;
};

module.exports = {
  calculateEstimatedPortionPrice,
  ensurePriceThresholdForProvince,
  findLatestMarketPrice,
  generatePriceThresholdsFromFoodPrices,
  getCostConfig,
  getLatestFoodPrices,
  listFoodPrices,
  normalizeRows
};
