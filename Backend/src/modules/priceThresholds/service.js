const { getPrismaClient } = require("../../config/prisma");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const foodPriceService = require("../foodPrices/service");

const prisma = getPrismaClient();

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

module.exports = {
  generateFromFoodPrices,
  listPriceThresholds
};
