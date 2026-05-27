const { Prisma } = require("@prisma/client");

const { getPrismaClient } = require("../../config/prisma");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const AppError = require("../../utils/appError");

const prisma = getPrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

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

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const toDateOnly = (value = new Date()) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const toInputDate = (date) => date.toISOString().slice(0, 10);

const withDefaultDateWindow = (filters = {}, days) => {
  if (filters.start_date || filters.end_date) {
    return filters;
  }

  const today = toDateOnly();
  return {
    ...filters,
    start_date: toInputDate(addDays(today, -(days - 1))),
    end_date: toInputDate(today)
  };
};

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

const buildCreatedAtDateFilter = (filters = {}) => {
  if (!filters.start_date && !filters.end_date) {
    return {};
  }

  return {
    createdAt: {
      ...(filters.start_date ? { gte: startOfDayUtc(filters.start_date) } : {}),
      ...(filters.end_date ? { lte: endOfDayUtc(filters.end_date) } : {})
    }
  };
};

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

const buildPublicReportWhere = (filters = {}) => ({
  ...(filters.province ? { province: { contains: filters.province, mode: "insensitive" } } : {}),
  ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
  ...buildCreatedAtDateFilter(filters)
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

const makeKpi = ({ key, title, value, valueType = "number", description = "" }) => ({
  key,
  title,
  value,
  valueType,
  description
});

const serializeDistribution = (distribution) => ({
  id: distribution.id,
  portions: distribution.portions,
  pricePerPortion: toNumber(distribution.pricePerPortion),
  totalCost: toNumber(distribution.totalCost),
  distributionDate: distribution.distributionDate,
  status: distribution.validation?.status || "pending",
  deliveryStatus: distribution.status,
  failureReason: distribution.failureReason,
  createdAt: distribution.createdAt,
  school: distribution.school
    ? {
        id: distribution.school.id,
        name: distribution.school.name,
        province: distribution.school.province,
        city: distribution.school.city
      }
    : null,
  sppg: distribution.sppg
    ? {
        id: distribution.sppg.id,
        name: distribution.sppg.name,
        province: distribution.sppg.province,
        city: distribution.sppg.city
      }
    : null,
  validation: distribution.validation
    ? {
        id: distribution.validation.id,
        status: distribution.validation.status,
        receivedPortions: distribution.validation.receivedPortions,
        qualityOk: distribution.validation.qualityOk,
        createdAt: distribution.validation.createdAt,
        validatedAt: distribution.validation.validatedAt
      }
    : null
});

const serializeValidation = (validation) => ({
  id: validation.id,
  receivedPortions: validation.receivedPortions,
  qualityOk: validation.qualityOk,
  status: validation.status,
  createdAt: validation.createdAt,
  validatedAt: validation.validatedAt,
  distribution: validation.distribution
    ? {
        id: validation.distribution.id,
        portions: validation.distribution.portions,
        distributionDate: validation.distribution.distributionDate,
        status: validation.distribution.status,
        sppg: validation.distribution.sppg
          ? {
              id: validation.distribution.sppg.id,
              name: validation.distribution.sppg.name,
              province: validation.distribution.sppg.province,
              city: validation.distribution.sppg.city
            }
          : null
      }
    : null
});

const serializeAnomaly = (anomaly) => {
  const distribution = anomaly.distribution;
  const sppg = distribution?.sppg;
  const school = distribution?.school;

  return {
    id: anomaly.id,
    anomalyType: anomaly.anomalyType,
    anomaly_type: anomaly.anomalyType,
    description: anomaly.description,
    isResolved: anomaly.isResolved,
    createdAt: anomaly.createdAt,
    created_at: anomaly.createdAt,
    distribution_status: distribution?.status || "open",
    distributionId: distribution?.id || null,
    sppg_name: sppg?.name || null,
    school_name: school?.name || null,
    distribution: distribution
      ? {
          id: distribution.id,
          status: distribution.status,
          distributionDate: distribution.distributionDate,
          sppg: sppg
            ? {
                id: sppg.id,
                name: sppg.name,
                province: sppg.province,
                city: sppg.city
              }
            : null,
          school: school
            ? {
                id: school.id,
                name: school.name,
                province: school.province,
                city: school.city
              }
            : null
        }
      : null
  };
};

const getDistributionTrend = async (filters) => {
  const whereSql = buildDistributionSqlWhere(filters);
  const rows = await prisma.$queryRaw`
    SELECT
      date_trunc('day', d.distribution_date)::date AS bucket,
      COUNT(v.id) FILTER (WHERE v.status = 'verified')::int AS verified,
      COUNT(v.id) FILTER (WHERE v.status = 'conflict')::int AS conflict,
      GREATEST(
        COUNT(d.id)::int - COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported'))::int,
        0
      ) AS pending
    FROM distributions d
    JOIN sppg s ON s.id = d.sppg_id
    JOIN schools sc ON sc.id = d.school_id
    LEFT JOIN validations v ON v.distribution_id = d.id
    ${whereSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return normalizeRows(rows).map((row) => ({
    label: row.bucket ? String(row.bucket).slice(0, 10) : "-",
    verified: toNumber(row.verified),
    conflict: toNumber(row.conflict),
    pending: toNumber(row.pending)
  }));
};

const getSuccessRateTrend = async (filters) => {
  const whereSql = buildDistributionSqlWhere(filters);
  const rows = await prisma.$queryRaw`
    SELECT
      date_trunc('day', d.distribution_date)::date AS bucket,
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
  `;

  return normalizeRows(rows).map((row) => ({
    label: row.bucket ? String(row.bucket).slice(0, 10) : "-",
    successRate: toNumber(row.success_rate)
  }));
};

const getProvinceRanking = async (filters) => {
  const whereSql = buildDistributionSqlWhere(filters);
  const rows = await prisma.$queryRaw`
    SELECT
      s.province,
      COUNT(d.id)::int AS total_distributions
    FROM distributions d
    JOIN sppg s ON s.id = d.sppg_id
    JOIN schools sc ON sc.id = d.school_id
    ${whereSql}
    GROUP BY s.province
    ORDER BY total_distributions DESC, s.province ASC
    LIMIT 10
  `;

  return normalizeRows(rows).map((row) => ({
    province: row.province || "-",
    totalDistributions: toNumber(row.total_distributions)
  }));
};

const buildNationalSummary = async ({ filters }) => {
  const today = toDateOnly();
  const distributionWhere = buildDistributionWhere(filters);
  const todayDistributionWhere = {
    sppg: {
      deletedAt: null,
      ...buildRegionFilter(filters)
    },
    school: {
      deletedAt: null
    },
    distributionDate: today
  };
  const validationWhere = {
    distribution: distributionWhere
  };
  const unresolvedAnomalyWhere = {
    isResolved: false,
    distribution: distributionWhere
  };

  const [
    totalActiveSppg,
    distributionsToday,
    verifiedCount,
    validatedCount,
    budgetAgg,
    anomalyTotal,
    publicReportTotal,
    distributionTrend,
    successRateTrend,
    provinceRanking,
    anomalyItems
  ] = await Promise.all([
    prisma.sppg.count({
      where: {
        deletedAt: null,
        status: "active",
        ...buildRegionFilter(filters)
      }
    }),
    prisma.distribution.count({
      where: todayDistributionWhere
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
    }),
    prisma.distribution.aggregate({
      where: distributionWhere,
      _sum: {
        totalCost: true
      }
    }),
    prisma.anomalyLog.count({
      where: unresolvedAnomalyWhere
    }),
    prisma.publicReport.count({
      where: buildPublicReportWhere(filters)
    }),
    getDistributionTrend(withDefaultDateWindow(filters, 7)),
    getSuccessRateTrend(withDefaultDateWindow(filters, 30)),
    getProvinceRanking(filters),
    prisma.anomalyLog.findMany({
      where: unresolvedAnomalyWhere,
      include: {
        distribution: {
          include: {
            sppg: {
              select: {
                id: true,
                name: true,
                province: true,
                city: true
              }
            },
            school: {
              select: {
                id: true,
                name: true,
                province: true,
                city: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    })
  ]);

  const successRate =
    validatedCount === 0 ? 0 : Number(((verifiedCount / validatedCount) * 100).toFixed(2));

  const alerts =
    anomalyTotal > 0
      ? [
          {
            type: "danger",
            title: "Anomali aktif",
            message: `${anomalyTotal} anomali belum resolved.`,
            count: anomalyTotal
          }
        ]
      : [];

  return {
    kpis: [
      makeKpi({
        key: "totalActiveSppg",
        title: "Total SPPG Aktif",
        value: totalActiveSppg,
        description: "SPPG aktif sesuai filter"
      }),
      makeKpi({
        key: "distributionsToday",
        title: "Distribusi Nasional Hari Ini",
        value: distributionsToday,
        description: "Distribusi tercatat hari ini"
      }),
      makeKpi({
        key: "successRate",
        title: "Success Rate",
        value: successRate,
        valueType: "percent",
        description: "Validasi verified dari total validasi"
      }),
      makeKpi({
        key: "anomalyTotal",
        title: "Anomali Terdeteksi",
        value: anomalyTotal,
        description: "Anomali aktif belum resolved"
      }),
      makeKpi({
        key: "budgetTotal",
        title: "Total Anggaran Digunakan",
        value: toNumber(budgetAgg._sum.totalCost),
        valueType: "currency",
        description: "Akumulasi periode filter"
      }),
      makeKpi({
        key: "publicReportTotal",
        title: "Laporan Masyarakat Masuk",
        value: publicReportTotal,
        description: "Laporan publik sesuai filter"
      })
    ],
    charts: {
      distributionTrend,
      successRateTrend,
      provinceRanking,
      portionsTrend: [],
      acceptanceTrend: []
    },
    recentData: {
      anomalies: anomalyItems.map(serializeAnomaly),
      distributionsToday: [],
      pendingValidations: [],
      validationsRecent: []
    },
    alerts
  };
};

const requireUserScope = (user, scopeField, code) => {
  const scopeId = user?.[scopeField];
  if (!scopeId) {
    throw new AppError("User scope is not configured for this dashboard.", 403, code);
  }

  return scopeId;
};

const getSppgSummary = async ({ user }) => {
  const sppgId = requireUserScope(user, "sppgId", "SPPG_SCOPE_MISSING");
  const today = toDateOnly();
  const trendStart = addDays(today, -6);

  const baseTodayWhere = {
    sppgId,
    distributionDate: today,
    school: {
      deletedAt: null
    }
  };

  const [
    totalPortionsAgg,
    deliveredCount,
    pendingCount,
    failedCount,
    portionsTrendRows,
    todayRows
  ] = await Promise.all([
    prisma.distribution.aggregate({
      where: baseTodayWhere,
      _sum: {
        portions: true
      }
    }),
    prisma.distribution.count({
      where: {
        ...baseTodayWhere,
        status: "delivered"
      }
    }),
    prisma.validation.count({
      where: {
        status: "pending",
        distribution: baseTodayWhere
      }
    }),
    prisma.distribution.count({
      where: {
        ...baseTodayWhere,
        status: "failed"
      }
    }),
    prisma.distribution.groupBy({
      by: ["distributionDate"],
      where: {
        sppgId,
        distributionDate: {
          gte: trendStart,
          lte: today
        },
        school: {
          deletedAt: null
        }
      },
      _sum: {
        portions: true
      },
      orderBy: {
        distributionDate: "asc"
      }
    }),
    prisma.distribution.findMany({
      where: baseTodayWhere,
      include: {
        school: {
          select: {
            id: true,
            name: true,
            province: true,
            city: true
          }
        },
        validation: {
          select: {
            id: true,
            status: true,
            receivedPortions: true,
            qualityOk: true,
            createdAt: true,
            validatedAt: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })
  ]);

  const alerts = [];
  if (pendingCount > 0) {
    alerts.push({
      type: "warning",
      title: "Validasi tertunda",
      message: `${pendingCount} distribusi menunggu konfirmasi sekolah.`,
      count: pendingCount
    });
  }
  if (failedCount > 0) {
    alerts.push({
      type: "danger",
      title: "Distribusi gagal",
      message: `${failedCount} distribusi hari ini perlu ditindaklanjuti.`,
      count: failedCount
    });
  }

  return {
    kpis: [
      makeKpi({
        key: "totalPortionsToday",
        title: "Total Porsi Diproduksi Hari Ini",
        value: toNumber(totalPortionsAgg._sum.portions),
        description: "Produksi aktif hari ini"
      }),
      makeKpi({
        key: "deliveredDistributions",
        title: "Distribusi Dikirim",
        value: deliveredCount,
        description: "Status delivered"
      }),
      makeKpi({
        key: "pendingValidations",
        title: "Menunggu Validasi",
        value: pendingCount,
        description: "Butuh konfirmasi sekolah"
      }),
      makeKpi({
        key: "failedDistributions",
        title: "Distribusi Gagal",
        value: failedCount,
        description: "Perlu ditindaklanjuti"
      })
    ],
    charts: {
      distributionTrend: [],
      successRateTrend: [],
      provinceRanking: [],
      portionsTrend: portionsTrendRows.map((row) => ({
        label: row.distributionDate ? toInputDate(row.distributionDate) : "-",
        portions: toNumber(row._sum.portions)
      })),
      acceptanceTrend: []
    },
    recentData: {
      anomalies: [],
      distributionsToday: todayRows.map(serializeDistribution),
      pendingValidations: [],
      validationsRecent: []
    },
    alerts
  };
};

const getSchoolSummary = async ({ user }) => {
  const schoolId = requireUserScope(user, "schoolId", "SCHOOL_SCOPE_MISSING");
  const today = toDateOnly();
  const trendStart = addDays(today, -29);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const todayDistributionWhere = {
    schoolId,
    distributionDate: today,
    sppg: {
      deletedAt: null
    }
  };

  const validationInclude = {
    distribution: {
      select: {
        id: true,
        portions: true,
        distributionDate: true,
        status: true,
        sppg: {
          select: {
            id: true,
            name: true,
            province: true,
            city: true
          }
        }
      }
    }
  };

  const [
    distributionsToday,
    pendingCount,
    receivedTodayAgg,
    reportTotal,
    acceptanceTrendRows,
    pendingValidations,
    validationsRecent
  ] = await Promise.all([
    prisma.distribution.count({
      where: todayDistributionWhere
    }),
    prisma.validation.count({
      where: {
        schoolId,
        status: "pending"
      }
    }),
    prisma.validation.aggregate({
      where: {
        schoolId,
        distribution: todayDistributionWhere
      },
      _sum: {
        receivedPortions: true
      }
    }),
    prisma.schoolReport.count({
      where: {
        schoolId,
        createdAt: {
          gte: monthStart
        }
      }
    }),
    prisma.$queryRaw`
      SELECT
        COALESCE(v.validated_at::date, d.distribution_date::date) AS bucket,
        COALESCE(SUM(v.received_portions), 0)::int AS received
      FROM validations v
      JOIN distributions d ON d.id = v.distribution_id
      JOIN sppg s ON s.id = d.sppg_id
      WHERE
        v.school_id = ${schoolId}
        AND s.deleted_at IS NULL
        AND d.distribution_date >= ${trendStart}
        AND d.distribution_date <= ${today}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.validation.findMany({
      where: {
        schoolId,
        status: "pending"
      },
      include: validationInclude,
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    }),
    prisma.validation.findMany({
      where: {
        schoolId
      },
      include: validationInclude,
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })
  ]);

  const alerts =
    pendingCount > 0
      ? [
          {
            type: "info",
            title: "Konfirmasi diperlukan",
            message: `${pendingCount} distribusi menunggu konfirmasi Anda.`,
            count: pendingCount
          }
        ]
      : [];

  return {
    kpis: [
      makeKpi({
        key: "distributionsToday",
        title: "Distribusi Hari Ini",
        value: distributionsToday,
        description: "Distribusi masuk hari ini"
      }),
      makeKpi({
        key: "pendingConfirmations",
        title: "Menunggu Konfirmasi",
        value: pendingCount,
        description: "Butuh validasi"
      }),
      makeKpi({
        key: "receivedPortionsToday",
        title: "Total Siswa Menerima Hari Ini",
        value: toNumber(receivedTodayAgg._sum.receivedPortions),
        description: "Porsi diterima"
      }),
      makeKpi({
        key: "schoolReportsThisMonth",
        title: "Laporan Terkirim Bulan Ini",
        value: reportTotal,
        description: "Rekap sekolah"
      })
    ],
    charts: {
      distributionTrend: [],
      successRateTrend: [],
      provinceRanking: [],
      portionsTrend: [],
      acceptanceTrend: normalizeRows(acceptanceTrendRows).map((row) => ({
        label: row.bucket ? String(row.bucket).slice(0, 10) : "-",
        received: toNumber(row.received)
      }))
    },
    recentData: {
      anomalies: [],
      distributionsToday: [],
      pendingValidations: pendingValidations.map(serializeValidation),
      validationsRecent: validationsRecent.map(serializeValidation)
    },
    alerts
  };
};

const getAdminSummary = ({ filters }) => buildNationalSummary({ filters });

const getGovSummary = ({ filters }) => buildNationalSummary({ filters });

module.exports = {
  getAdminSummary,
  getGovSummary,
  getSchoolSummary,
  getSppgSummary
};
