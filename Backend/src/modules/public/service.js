const { getPrismaClient } = require("../../config/prisma");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const AppError = require("../../utils/appError");
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
  ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
  ...(query.status ? { status: query.status } : {})
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
          menuName: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true
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

module.exports = {
  getPublicSppgList,
  getPublicSppgDetail
};
