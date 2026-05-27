const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const foodPriceService = require("../foodPrices/service");

const prisma = getPrismaClient();

const normalizeRow = (row) => foodPriceService.normalizeRows([row])[0];

const serializePublicThreshold = (threshold) => {
  if (!threshold) {
    return null;
  }

  const row = normalizeRow(threshold);

  return {
    id: row.id,
    province: row.province,
    minPrice: row.minPrice,
    min_price: row.minPrice,
    maxPrice: row.maxPrice,
    max_price: row.maxPrice,
    avgReferencePrice: row.avgReferencePrice,
    avg_reference_price: row.avgReferencePrice,
    source: row.source,
    generatedFromFoodPrices: row.generatedFromFoodPrices,
    generated_from_food_prices: row.generatedFromFoodPrices,
    generatedAt: row.generatedAt,
    generated_at: row.generatedAt,
    updatedAt: row.updatedAt,
    updated_at: row.updatedAt
  };
};

const listPriceThresholds = async ({ query = {} }) => {
  const pagination = parsePagination(query);
  const where = {
    ...(query.province
      ? {
          province: {
            contains: query.province,
            mode: "insensitive"
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.priceThreshold.findMany({
      where,
      include: {
        updatedByUser: {
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
        province: "asc"
      }
    }),
    prisma.priceThreshold.count({ where })
  ]);

  return {
    data: foodPriceService.normalizeRows(items),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const generateFromFoodPrices = async ({ actorUserId }) =>
  foodPriceService.generatePriceThresholdsFromFoodPrices({
    actorUserId
  });

const getMyRegionThreshold = async ({ user }) => {
  const sppgId = requireSppgScope(user);
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(sppgId),
      deletedAt: null
    },
    select: {
      id: true,
      province: true,
      city: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  const threshold = await prisma.priceThreshold.findFirst({
    where: {
      province: {
        equals: sppg.province,
        mode: "insensitive"
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return {
    data: serializePublicThreshold(threshold),
    meta: {
      province: sppg.province,
      city: sppg.city,
      reason: threshold ? null : "THRESHOLD_NOT_AVAILABLE"
    }
  };
};

module.exports = {
  generateFromFoodPrices,
  getMyRegionThreshold,
  listPriceThresholds
};
