const { getPrismaClient } = require("../../config/prisma");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const AppError = require("../../utils/appError");
const { normalizeCityName, normalizeProvinceName } = require("../../utils/region");
const analyticsService = require("../analytics/service");
const { serializePublicSppgDetail, serializePublicSppgMarker } = require("./serializer");

const prisma = getPrismaClient();

const roundOneDecimal = (value) => Math.round((Number(value) || 0) * 10) / 10;

const getSafeListLimit = (value) => {
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : null;
};

const publicSppgSelect = {
  id: true,
  name: true,
  province: true,
  city: true,
  status: true,
  lat: true,
  lng: true,
  capacity: true
};

const buildPublicSppgWhere = (query = {}) => ({
  deletedAt: null,
  ...(query.province ? { province: { contains: normalizeProvinceName(query.province) || query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: normalizeCityName(query.city) || query.city, mode: "insensitive" } } : {}),
  ...(query.status ? { status: query.status } : {})
});

const toNumber = (value) => Number(value) || 0;

const getPublicFilterOptions = async () => {
  const rows = await prisma.sppg.findMany({
    where: {
      deletedAt: null
    },
    distinct: ["province", "city"],
    select: {
      province: true,
      city: true
    },
    orderBy: [{ province: "asc" }, { city: "asc" }]
  });

  const provinces = new Set();
  const cities = new Map();

  for (const row of rows) {
    const province = normalizeProvinceName(row.province);
    const city = normalizeCityName(row.city);
    if (province) provinces.add(province);
    if (city) {
      cities.set(`${province || "-"}|${city}`, { province, city });
    }
  }

  return {
    provinces: Array.from(provinces).sort((first, second) => first.localeCompare(second, "id")),
    cities: Array.from(cities.values()).sort((first, second) =>
      `${first.province || ""}${first.city}`.localeCompare(`${second.province || ""}${second.city}`, "id")
    )
  };
};

const getPublicFilters = (query = {}) => ({
  province: normalizeProvinceName(query.province) || query.province,
  city: normalizeCityName(query.city) || query.city,
  start_date: query.start_date,
  end_date: query.end_date
});

const serializeTrendRow = (row) => ({
  date: row.bucket,
  totalDistributions: toNumber(row.total_distributions),
  totalPortions: toNumber(row.total_portions),
  deliveredCount: toNumber(row.delivered_count),
  failedCount: toNumber(row.failed_count)
});

const serializeSuccessRateRow = (row) => ({
  date: row.bucket,
  province: row.province,
  city: row.city,
  verifiedCount: toNumber(row.verified_count),
  conflictCount: toNumber(row.conflict_count),
  validatedCount: toNumber(row.validated_count),
  successRate: toNumber(row.success_rate)
});

const serializeProvinceRow = (row) => ({
  province: row.province || "-",
  totalDistributions: toNumber(row.total_distributions),
  totalPortions: toNumber(row.total_portions),
  totalBudget: toNumber(row.total_budget),
  avgPricePerPortion: toNumber(row.avg_price_per_portion),
  successRate: toNumber(row.success_rate)
});

const serializeBudgetSummary = (row = {}) => ({
  totalDistributions: toNumber(row.total_distributions),
  totalPortions: toNumber(row.total_portions),
  totalBudget: toNumber(row.total_budget),
  avgPricePerPortion: toNumber(row.avg_price_per_portion)
});

const serializeBudgetProvinceRow = (row) => ({
  province: row.province || "-",
  totalDistributions: toNumber(row.total_distributions),
  totalPortions: toNumber(row.total_portions),
  totalBudget: toNumber(row.total_budget),
  avgPricePerPortion: toNumber(row.avg_price_per_portion),
  minPricePerPortion: toNumber(row.min_price_per_portion),
  maxPricePerPortion: toNumber(row.max_price_per_portion)
});

const serializeBudgetCityRow = (row) => ({
  province: row.province || "-",
  city: row.city || "-",
  totalDistributions: toNumber(row.total_distributions),
  totalPortions: toNumber(row.total_portions),
  totalBudget: toNumber(row.total_budget),
  avgPricePerPortion: toNumber(row.avg_price_per_portion)
});

const getPublicSppgList = async ({ query = {} } = {}) => {
  const listLimit = getSafeListLimit(query.limit);

  const sppgRows = await prisma.sppg.findMany({
    where: buildPublicSppgWhere(query),
    select: publicSppgSelect,
    orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }],
    ...(listLimit ? { take: listLimit } : {})
  });

  return {
    data: sppgRows.map((sppg) => serializePublicSppgMarker({ sppg }))
  };
};

const getPublicSppgDetail = async ({ id }) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      lat: true,
      lng: true,
      status: true,
      capacity: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  const today = new Date();
  const todayStart = startOfDayUtc(today);
  const todayEnd = endOfDayUtc(today);

  const [districtSource, todayPortionsAggregate, distributionStatusCounts, todayMenu, recentDistributions] =
    await Promise.all([
      prisma.school.findFirst({
        where: {
          sppgId: sppg.id,
          deletedAt: null,
          district: {
            not: null
          }
        },
        select: {
          district: true
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
      }),
      prisma.distribution.aggregate({
        where: {
          sppgId: sppg.id,
          distributionDate: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        _sum: {
          portions: true
        }
      }),
      prisma.distribution.groupBy({
        by: ["status"],
        where: {
          sppgId: sppg.id
        },
        _count: {
          _all: true
        }
      }),
      prisma.menu.findFirst({
        where: {
          sppgId: sppg.id,
          deletedAt: null,
          menuDate: {
            lte: todayEnd
          }
        },
        select: {
          id: true,
          menuDate: true,
          menuName: true,
          items: true,
          manualPricePerPortion: true,
          priceValidationStatus: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          photoFile: {
            select: {
              fileUrl: true,
              mimeType: true,
              originalName: true
            }
          }
        },
        orderBy: [{ menuDate: "desc" }, { createdAt: "desc" }]
      }),
      prisma.distribution.findMany({
        where: {
          sppgId: sppg.id
        },
        select: {
          id: true,
          portions: true,
          status: true,
          distributionDate: true,
          validation: {
            select: {
              status: true
            }
          },
          school: {
            select: {
              name: true
            }
          }
        },
        orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }],
        take: 5
      })
    ]);

  const statusCounts = distributionStatusCounts.reduce(
    (result, row) => {
      result[row.status] = row._count._all;
      return result;
    },
    { delivered: 0, failed: 0, in_progress: 0 }
  );
  const completedTotal = statusCounts.delivered + statusCounts.failed;
  const successRate = completedTotal ? roundOneDecimal((statusCounts.delivered / completedTotal) * 100) : 0;

  return {
    data: serializePublicSppgDetail({
      sppg,
      district: districtSource?.district || null,
      todayPortions: todayPortionsAggregate._sum.portions,
      successRate,
      todayMenu,
      recentDistributions
    })
  };
};

const getPublicStatistics = async ({ query = {} } = {}) => {
  const filters = getPublicFilters(query);
  const granularity = query.granularity || "daily";
  const limit = Number(query.limit) || 10;

  const [summary, trend, successRate, byProvince, filterOptions] = await Promise.all([
    analyticsService.getSummary({ filters }),
    analyticsService.getDistributionTrend({ filters, granularity }),
    analyticsService.getSuccessRate({ filters, granularity }),
    analyticsService.getByProvince({ filters, limit }),
    getPublicFilterOptions()
  ]);

  const kpis = summary.data || {
    totalActiveSppg: 0,
    distributionsToday: 0,
    successRate: 0,
    problematicSppg: 0
  };
  const distributionTrend = Array.isArray(trend.data) ? trend.data.map(serializeTrendRow) : [];
  const successRateData = successRate.data || {};
  const topRegions = Array.isArray(byProvince.data) ? byProvince.data.map(serializeProvinceRow) : [];

  return {
    data: {
      kpis,
      charts: {
        distributionTrend,
        successRateTrend: Array.isArray(successRateData.timeSeries)
          ? successRateData.timeSeries.map(serializeSuccessRateRow)
          : [],
        successRateByProvince: Array.isArray(successRateData.byProvince)
          ? successRateData.byProvince.map(serializeSuccessRateRow)
          : [],
        distributionsByProvince: topRegions
      },
      recentData: {
        topRegions
      },
      alerts: [],
      filters: filterOptions,
      meta: {
        granularity,
        isEmpty:
          toNumber(kpis.totalActiveSppg) === 0 &&
          toNumber(kpis.distributionsToday) === 0 &&
          distributionTrend.length === 0 &&
          topRegions.length === 0
      }
    }
  };
};

const getPublicBudget = async ({ query = {} } = {}) => {
  const filters = getPublicFilters(query);
  const [budget, filterOptions] = await Promise.all([
    analyticsService.getBudget({ filters }),
    getPublicFilterOptions()
  ]);
  const budgetData = budget.data || {};
  const summary = serializeBudgetSummary(budgetData.summary || {});
  const byProvince = Array.isArray(budgetData.byProvince)
    ? budgetData.byProvince.map(serializeBudgetProvinceRow)
    : [];
  const byCity = Array.isArray(budgetData.byCity) ? budgetData.byCity.map(serializeBudgetCityRow) : [];

  return {
    data: {
      kpis: summary,
      charts: {
        budgetByProvince: byProvince,
        priceByProvince: byProvince.map((row) => ({
          province: row.province,
          avgPricePerPortion: row.avgPricePerPortion,
          minPricePerPortion: row.minPricePerPortion,
          maxPricePerPortion: row.maxPricePerPortion
        })),
        budgetByCity: byCity
      },
      recentData: {
        topBudgetRegions: byProvince.slice(0, 10)
      },
      alerts: [],
      filters: filterOptions,
      meta: {
        isEmpty:
          summary.totalBudget === 0 &&
          summary.totalPortions === 0 &&
          byProvince.length === 0 &&
          byCity.length === 0
      }
    }
  };
};

module.exports = {
  getPublicBudget,
  getPublicStatistics,
  getPublicSppgList,
  getPublicSppgDetail
};
