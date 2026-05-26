const { Prisma } = require("@prisma/client");

const { getPrismaClient } = require("../../config/prisma");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const reportService = require("../reports/service");

const prisma = getPrismaClient();

const GRANULARITY_SQL = {
  daily: Prisma.raw("date_trunc('day', d.distribution_date)::date"),
  weekly: Prisma.raw("date_trunc('week', d.distribution_date)::date"),
  monthly: Prisma.raw("date_trunc('month', d.distribution_date)::date")
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

const buildRegionFilter = (filters = {}) => ({
  ...(filters.province ? { province: { contains: filters.province, mode: "insensitive" } } : {}),
  ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {})
});

const buildDistributionDateFilter = (filters = {}) => {
  if (!filters.start_date && !filters.end_date) {
    return {};
  }

  return {
    distributionDate: {
      ...(filters.start_date ? { gte: startOfDayUtc(filters.start_date) } : {}),
      ...(filters.end_date ? { lte: endOfDayUtc(filters.end_date) } : {})
    }
  };
};

const buildValidationWhere = (filters = {}) => ({
  distribution: {
    sppg: {
      deletedAt: null,
      ...buildRegionFilter(filters)
    },
    school: {
      deletedAt: null
    },
    ...buildDistributionDateFilter(filters)
  }
});

const buildDistributionWhere = (filters = {}) => ({
  sppg: {
    deletedAt: null,
    ...buildRegionFilter(filters)
  },
  school: {
    deletedAt: null
  },
  ...buildDistributionDateFilter(filters)
});

const buildProductionBatchDateFilter = (filters = {}) => {
  if (!filters.start_date && !filters.end_date) {
    return {};
  }

  return {
    productionDate: {
      ...(filters.start_date ? { gte: startOfDayUtc(filters.start_date) } : {}),
      ...(filters.end_date ? { lte: endOfDayUtc(filters.end_date) } : {})
    }
  };
};

const buildProductionBatchWhere = (filters = {}) => ({
  sppg: {
    deletedAt: null,
    ...buildRegionFilter(filters)
  },
  ...buildProductionBatchDateFilter(filters)
});

const buildDistributionSqlWhere = (filters = {}) => {
  const conditions = [Prisma.sql`s.deleted_at IS NULL`, Prisma.sql`sc.deleted_at IS NULL`];

  if (filters.province) {
    conditions.push(Prisma.sql`s.province ILIKE ${`%${filters.province}%`}`);
  }

  if (filters.city) {
    conditions.push(Prisma.sql`s.city ILIKE ${`%${filters.city}%`}`);
  }

  if (filters.start_date) {
    conditions.push(Prisma.sql`d.distribution_date >= ${startOfDayUtc(filters.start_date)}`);
  }

  if (filters.end_date) {
    conditions.push(Prisma.sql`d.distribution_date <= ${endOfDayUtc(filters.end_date)}`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
};

const buildAnomalySqlWhere = (filters = {}) => {
  const conditions = [
    Prisma.sql`s.deleted_at IS NULL`,
    Prisma.sql`sc.deleted_at IS NULL`
  ];

  if (filters.is_resolved !== undefined) {
    conditions.push(Prisma.sql`a.is_resolved = ${filters.is_resolved}`);
  } else {
    conditions.push(Prisma.sql`a.is_resolved = FALSE`);
  }

  if (filters.anomaly_type) {
    conditions.push(Prisma.sql`a.anomaly_type = ${filters.anomaly_type}::"AnomalyType"`);
  }

  if (filters.province) {
    conditions.push(Prisma.sql`s.province ILIKE ${`%${filters.province}%`}`);
  }

  if (filters.city) {
    conditions.push(Prisma.sql`s.city ILIKE ${`%${filters.city}%`}`);
  }

  if (filters.start_date) {
    conditions.push(Prisma.sql`a.created_at >= ${startOfDayUtc(filters.start_date)}`);
  }

  if (filters.end_date) {
    conditions.push(Prisma.sql`a.created_at <= ${endOfDayUtc(filters.end_date)}`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
};

const getSummary = async ({ filters }) => {
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const distributionWhere = buildDistributionWhere(filters);
  const validationWhere = buildValidationWhere(filters);

  const [totalActiveSppg, problematicSppg, distributionsToday, verifiedCount, validatedCount] =
    await Promise.all([
      prisma.sppg.count({
        where: {
          deletedAt: null,
          status: "active",
          ...buildRegionFilter(filters)
        }
      }),
      prisma.sppg.count({
        where: {
          deletedAt: null,
          status: "problem",
          ...buildRegionFilter(filters)
        }
      }),
      prisma.distribution.count({
        where: {
          ...distributionWhere,
          distributionDate: todayDate
        }
      }),
      prisma.validation.count({
        where: {
          ...validationWhere,
          status: "verified"
        }
      }),
      prisma.validation.count({
        where: {
          ...validationWhere,
          status: {
            in: ["verified", "conflict"]
          }
        }
      })
    ]);

  return {
    data: {
      totalActiveSppg,
      distributionsToday,
      successRate: validatedCount === 0 ? 0 : Number(((verifiedCount / validatedCount) * 100).toFixed(2)),
      problematicSppg
    }
  };
};

const getDistributionTrend = async ({ filters, granularity }) => {
  const bucketExpression = GRANULARITY_SQL[granularity] || GRANULARITY_SQL.daily;
  const whereSql = buildDistributionSqlWhere(filters);

  const rows = await prisma.$queryRaw`
    SELECT
      ${bucketExpression} AS bucket,
      COUNT(*)::int AS total_distributions,
      COALESCE(SUM(d.portions), 0)::int AS total_portions,
      COALESCE(SUM(d.total_cost), 0) AS total_cost,
      COUNT(*) FILTER (WHERE d.status = 'delivered')::int AS delivered_count,
      COUNT(*) FILTER (WHERE d.status = 'failed')::int AS failed_count
    FROM distributions d
    JOIN sppg s ON s.id = d.sppg_id
    JOIN schools sc ON sc.id = d.school_id
    ${whereSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return {
    data: normalizeRows(rows),
    meta: {
      granularity
    }
  };
};

const getSuccessRate = async ({ filters, granularity }) => {
  const bucketExpression = GRANULARITY_SQL[granularity] || GRANULARITY_SQL.daily;
  const whereSql = buildDistributionSqlWhere(filters);

  const [timeSeries, byProvince, byCity] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        ${bucketExpression} AS bucket,
        COUNT(v.id) FILTER (WHERE v.status = 'verified')::int AS verified_count,
        COUNT(v.id) FILTER (WHERE v.status = 'conflict')::int AS conflict_count,
        COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported'))::int AS validated_count,
        COALESCE(
          ROUND(
            100.0 * COUNT(v.id) FILTER (WHERE v.status = 'verified')
            / NULLIF(COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported')), 0),
            2
          ),
          0
        ) AS success_rate
      FROM distributions d
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      LEFT JOIN validations v ON v.distribution_id = d.id
      ${whereSql}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw`
      SELECT
        s.province,
        COUNT(v.id) FILTER (WHERE v.status = 'verified')::int AS verified_count,
        COUNT(v.id) FILTER (WHERE v.status = 'conflict')::int AS conflict_count,
        COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported'))::int AS validated_count,
        COALESCE(
          ROUND(
            100.0 * COUNT(v.id) FILTER (WHERE v.status = 'verified')
            / NULLIF(COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported')), 0),
            2
          ),
          0
        ) AS success_rate
      FROM distributions d
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      LEFT JOIN validations v ON v.distribution_id = d.id
      ${whereSql}
      GROUP BY s.province
      ORDER BY success_rate DESC, s.province ASC
    `,
    prisma.$queryRaw`
      SELECT
        s.province,
        s.city,
        COUNT(v.id) FILTER (WHERE v.status = 'verified')::int AS verified_count,
        COUNT(v.id) FILTER (WHERE v.status = 'conflict')::int AS conflict_count,
        COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported'))::int AS validated_count,
        COALESCE(
          ROUND(
            100.0 * COUNT(v.id) FILTER (WHERE v.status = 'verified')
            / NULLIF(COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported')), 0),
            2
          ),
          0
        ) AS success_rate
      FROM distributions d
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      LEFT JOIN validations v ON v.distribution_id = d.id
      ${whereSql}
      GROUP BY s.province, s.city
      ORDER BY success_rate DESC, s.province ASC, s.city ASC
      LIMIT 20
    `
  ]);

  return {
    data: {
      timeSeries: normalizeRows(timeSeries),
      byProvince: normalizeRows(byProvince),
      byCity: normalizeRows(byCity)
    },
    meta: {
      granularity
    }
  };
};

const getBudget = async ({ filters }) => {
  const whereSql = buildDistributionSqlWhere(filters);

  const [summaryRows, byProvince, byCity] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(d.id)::int AS total_distributions,
        COALESCE(SUM(d.portions), 0)::int AS total_portions,
        COALESCE(SUM(d.total_cost), 0) AS total_budget,
        COALESCE(ROUND(AVG(d.price_per_portion), 2), 0) AS avg_price_per_portion
      FROM distributions d
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      ${whereSql}
    `,
    prisma.$queryRaw`
      SELECT
        s.province,
        COUNT(d.id)::int AS total_distributions,
        COALESCE(SUM(d.portions), 0)::int AS total_portions,
        COALESCE(SUM(d.total_cost), 0) AS total_budget,
        COALESCE(ROUND(AVG(d.price_per_portion), 2), 0) AS avg_price_per_portion,
        COALESCE(MIN(d.price_per_portion), 0) AS min_price_per_portion,
        COALESCE(MAX(d.price_per_portion), 0) AS max_price_per_portion
      FROM distributions d
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      ${whereSql}
      GROUP BY s.province
      ORDER BY total_budget DESC, s.province ASC
    `,
    prisma.$queryRaw`
      SELECT
        s.province,
        s.city,
        COUNT(d.id)::int AS total_distributions,
        COALESCE(SUM(d.portions), 0)::int AS total_portions,
        COALESCE(SUM(d.total_cost), 0) AS total_budget,
        COALESCE(ROUND(AVG(d.price_per_portion), 2), 0) AS avg_price_per_portion
      FROM distributions d
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      ${whereSql}
      GROUP BY s.province, s.city
      ORDER BY total_budget DESC, s.province ASC, s.city ASC
      LIMIT 20
    `
  ]);

  return {
    data: {
      summary: normalizeRows(summaryRows)[0] || null,
      byProvince: normalizeRows(byProvince),
      byCity: normalizeRows(byCity)
    }
  };
};

const getBudgetSummary = async ({ filters }) => {
  const batchWhere = buildProductionBatchWhere(filters);
  const [batchAgg, totalBatches, priceAnomalyCount, rawMaterialAnomalyCount, publicReportCount] = await Promise.all([
    prisma.productionBatch.aggregate({
      where: batchWhere,
      _sum: {
        totalCost: true,
        totalPortions: true,
        rawMaterialCost: true,
        operationalCost: true,
        packagingCost: true,
        distributionCost: true
      },
      _avg: {
        costPerPortion: true,
        rawMaterialCost: true,
        operationalCost: true,
        packagingCost: true,
        distributionCost: true
      }
    }),
    prisma.productionBatch.count({
      where: batchWhere
    }),
    prisma.anomalyLog.count({
      where: {
        anomalyType: "PRICE_ANOMALY",
        isResolved: false
      }
    }),
    prisma.anomalyLog.count({
      where: {
        anomalyType: "RAW_MATERIAL_PRICE_ANOMALY",
        isResolved: false
      }
    }),
    prisma.publicReport.count()
  ]);

  return {
    data: {
      total_batches: totalBatches,
      total_portions: Number(batchAgg._sum.totalPortions || 0),
      total_budget_used: Number(batchAgg._sum.totalCost || 0),
      total_raw_material_cost: Number(batchAgg._sum.rawMaterialCost || 0),
      total_operational_cost: Number(batchAgg._sum.operationalCost || 0),
      total_packaging_cost: Number(batchAgg._sum.packagingCost || 0),
      total_distribution_cost: Number(batchAgg._sum.distributionCost || 0),
      avg_cost_per_portion: Number(batchAgg._avg.costPerPortion || 0),
      avg_price_per_portion: Number(batchAgg._avg.costPerPortion || 0),
      avg_raw_material_cost: Number(batchAgg._avg.rawMaterialCost || 0),
      avg_operational_cost: Number(batchAgg._avg.operationalCost || 0),
      avg_packaging_cost: Number(batchAgg._avg.packagingCost || 0),
      avg_distribution_cost: Number(batchAgg._avg.distributionCost || 0),
      price_anomaly_count: priceAnomalyCount,
      raw_material_anomaly_count: rawMaterialAnomalyCount,
      savings_vs_target: 0,
      public_report_count: publicReportCount
    }
  };
};

const getPricePerProvince = async ({ filters }) => {
  const batchRows = await prisma.productionBatch.findMany({
    where: buildProductionBatchWhere(filters),
    include: {
      sppg: {
        select: {
          province: true
        }
      }
    }
  });
  const thresholdWhere = filters.province
    ? {
        province: {
          contains: filters.province,
          mode: "insensitive"
        }
      }
    : {};
  const thresholds = await prisma.priceThreshold.findMany({
    where: thresholdWhere,
    orderBy: {
      province: "asc"
    }
  });

  const provinceMap = new Map();

  for (const batch of batchRows) {
    const province = batch.sppg?.province;
    if (!province) {
      continue;
    }

    const current = provinceMap.get(province) || {
      province,
      minHarga: Number(batch.costPerPortion),
      maxHarga: Number(batch.costPerPortion),
      costTotal: 0,
      totalBudget: 0,
      totalDistributions: 0
    };
    const costPerPortion = Number(batch.costPerPortion);
    current.minHarga = Math.min(current.minHarga, costPerPortion);
    current.maxHarga = Math.max(current.maxHarga, costPerPortion);
    current.costTotal += costPerPortion;
    current.totalBudget += Number(batch.totalCost || 0);
    current.totalDistributions += 1;
    current.avgHarga = current.totalDistributions ? current.costTotal / current.totalDistributions : 0;
    provinceMap.set(province, current);
  }

  for (const threshold of normalizeRows(thresholds)) {
    const current = provinceMap.get(threshold.province) || {
      province: threshold.province,
      minHarga: 0,
      maxHarga: 0,
      avgHarga: Number(threshold.avgReferencePrice || 0),
      totalBudget: 0,
      totalDistributions: 0
    };

    provinceMap.set(threshold.province, {
      ...current,
      thresholdMin: Number(threshold.minPrice || 0),
      thresholdMax: Number(threshold.maxPrice || 0),
      avgReferencePrice: Number(threshold.avgReferencePrice || 0),
      source: threshold.source,
      generatedFromFoodPrices: threshold.generatedFromFoodPrices,
      generatedAt: threshold.generatedAt
    });
  }

  return {
    data: Array.from(provinceMap.values()).sort((a, b) => b.totalBudget - a.totalBudget)
  };
};

const getPriceAnomalies = async ({ filters, pagination }) => {
  const where = {
    anomalyType: "PRICE_ANOMALY",
    ...(filters.is_resolved !== undefined ? { isResolved: filters.is_resolved } : {}),
    distribution: {
      sppg: {
        deletedAt: null,
        ...buildRegionFilter(filters)
      },
      school: {
        deletedAt: null
      },
      ...buildDistributionDateFilter(filters)
    }
  };

  const [items, total] = await Promise.all([
    prisma.anomalyLog.findMany({
      where,
      include: {
        distribution: {
          include: {
            sppg: true,
            school: true
          }
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.anomalyLog.count({ where })
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

const getCostingAnalytics = async ({ filters }) => {
  const [summary, byProvince] = await Promise.all([
    getBudgetSummary({ filters }),
    getPricePerProvince({ filters })
  ]);

  return {
    data: {
      summary: summary.data,
      byProvince: byProvince.data,
      topExpensiveProvinces: [...byProvince.data]
        .sort((a, b) => Number(b.avgHarga || 0) - Number(a.avgHarga || 0))
        .slice(0, 10)
    }
  };
};

const getByProvince = async ({ filters, limit }) => {
  const whereSql = buildDistributionSqlWhere(filters);
  const safeLimit = Number(limit) || 10;

  const rows = await prisma.$queryRaw`
    SELECT
      s.province,
      COUNT(d.id)::int AS total_distributions,
      COALESCE(SUM(d.portions), 0)::int AS total_portions,
      COALESCE(SUM(d.total_cost), 0) AS total_budget,
      COALESCE(ROUND(AVG(d.price_per_portion), 2), 0) AS avg_price_per_portion,
      COALESCE(
        ROUND(
          100.0 * COUNT(v.id) FILTER (WHERE v.status = 'verified')
          / NULLIF(COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported')), 0),
          2
        ),
        0
      ) AS success_rate
    FROM distributions d
    JOIN sppg s ON s.id = d.sppg_id
    JOIN schools sc ON sc.id = d.school_id
    LEFT JOIN validations v ON v.distribution_id = d.id
    ${whereSql}
    GROUP BY s.province
    ORDER BY total_portions DESC, s.province ASC
    LIMIT ${safeLimit}
  `;

  return {
    data: normalizeRows(rows),
    meta: {
      limit: safeLimit
    }
  };
};

const getAnomaly = async ({ filters, pagination }) => {
  const whereSql = buildAnomalySqlWhere(filters);

  const [summaryRows, totalRows, items] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        a.anomaly_type,
        COUNT(*)::int AS total
      FROM anomaly_logs a
      JOIN distributions d ON d.id = a.distribution_id
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      ${whereSql}
      GROUP BY a.anomaly_type
      ORDER BY total DESC, a.anomaly_type ASC
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS total
      FROM anomaly_logs a
      JOIN distributions d ON d.id = a.distribution_id
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      ${whereSql}
    `,
    prisma.$queryRaw`
      SELECT
        a.id,
        a.anomaly_type,
        a.description,
        a.created_at,
        a.distribution_id,
        s.name AS sppg_name,
        s.province,
        s.city,
        sc.name AS school_name,
        d.status AS distribution_status,
        d.distribution_date
      FROM anomaly_logs a
      JOIN distributions d ON d.id = a.distribution_id
      JOIN sppg s ON s.id = d.sppg_id
      JOIN schools sc ON sc.id = d.school_id
      ${whereSql}
      ORDER BY a.created_at DESC
      OFFSET ${pagination.skip}
      LIMIT ${pagination.limit}
    `
  ]);

  const total = normalizeRows(totalRows)[0]?.total || 0;

  return {
    data: {
      summary: normalizeRows(summaryRows),
      items: normalizeRows(items)
    },
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getPublicReportsSummary = async ({ filters }) =>
  reportService.getPublicReportsSummary({
    query: filters
  });

const getPublicReportsTrend = async ({ filters }) =>
  reportService.getPublicReportsTrend({
    query: filters
  });

const getPublicReportsTopRegions = async ({ filters, limit }) =>
  reportService.getPublicReportsTopRegions({
    query: filters,
    limit
  });

module.exports = {
  getAnomaly,
  getBudget,
  getBudgetSummary,
  getByProvince,
  getCostingAnalytics,
  getDistributionTrend,
  getPriceAnomalies,
  getPricePerProvince,
  getPublicReportsSummary,
  getPublicReportsTopRegions,
  getPublicReportsTrend,
  getSuccessRate,
  getSummary,
  parseAnalyticsPagination: parsePagination
};
