const { getPrismaClient } = require("../../config/prisma");

const prisma = getPrismaClient();

const EMPTY_RESULTS = {
  sppg: [],
  schools: [],
  distributions: [],
  reports: []
};

const ADMIN_SCOPED_ROLES = new Set(["admin", "pemerintah"]);
const ISSUE_CATEGORIES = ["logistik", "keterlambatan", "kekurangan_bahan", "peralatan", "lainnya"];
const ISSUE_STATUSES = ["open", "in_progress", "resolved"];
const REPORT_CATEGORIES = ["kualitas_makanan", "keterlambatan", "kekurangan_porsi", "lainnya"];
const PUBLIC_REPORT_STATUSES = ["baru", "ditinjau", "ditindak", "ditutup"];

const isAdminScoped = (user) => ADMIN_SCOPED_ROLES.has(user.role);

const textContains = (value) => ({
  contains: value,
  mode: "insensitive"
});

const numericIdFilter = (query) => (Number.isInteger(Number(query)) ? [{ id: Number(query) }] : []);

const enumFilters = (field, query, values) => {
  const normalizedQuery = String(query || "").toLowerCase();

  return values
    .filter((value) => value.includes(normalizedQuery))
    .map((value) => ({
      [field]: value
    }));
};

const createResult = ({ id, entity, title, subtitle, url, meta = {} }) => ({
  id: String(id),
  entity,
  title,
  subtitle,
  url,
  meta
});

const formatDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : null);

const matchSppgWhere = ({ query, user }) => {
  const base = {
    deletedAt: null,
    OR: [
      { name: textContains(query) },
      { province: textContains(query) },
      { city: textContains(query) },
      { address: textContains(query) },
      ...numericIdFilter(query)
    ]
  };

  if (isAdminScoped(user)) return base;

  if (user.role === "sppg" && user.sppgId) {
    return {
      ...base,
      id: user.sppgId
    };
  }

  if (user.role === "sekolah" && user.schoolId) {
    return {
      ...base,
      schools: {
        some: {
          id: user.schoolId,
          deletedAt: null
        }
      }
    };
  }

  return null;
};

const matchSchoolWhere = ({ query, user }) => {
  const base = {
    deletedAt: null,
    sppg: {
      deletedAt: null
    },
    OR: [
      { name: textContains(query) },
      { npsn: textContains(query) },
      { city: textContains(query) },
      { district: textContains(query) },
      ...numericIdFilter(query)
    ]
  };

  if (isAdminScoped(user)) return base;

  if (user.role === "sppg" && user.sppgId) {
    return {
      ...base,
      sppgId: user.sppgId
    };
  }

  if (user.role === "sekolah" && user.schoolId) {
    return {
      ...base,
      id: user.schoolId
    };
  }

  return null;
};

const matchDistributionWhere = ({ query, user }) => {
  const base = {
    school: {
      deletedAt: null
    },
    sppg: {
      deletedAt: null
    },
    OR: [
      {
        sppg: {
          deletedAt: null,
          name: textContains(query)
        }
      },
      {
        school: {
          deletedAt: null,
          name: textContains(query)
        }
      },
      {
        school: {
          deletedAt: null,
          city: textContains(query)
        }
      },
      ...numericIdFilter(query)
    ]
  };

  if (isAdminScoped(user)) return base;

  if (user.role === "sppg" && user.sppgId) {
    return {
      ...base,
      sppgId: user.sppgId
    };
  }

  if (user.role === "sekolah" && user.schoolId) {
    return {
      ...base,
      schoolId: user.schoolId
    };
  }

  return null;
};

const publicReportWhere = (query) => ({
  OR: [
    { message: textContains(query) },
    { province: textContains(query) },
    { city: textContains(query) },
    ...enumFilters("status", query, PUBLIC_REPORT_STATUSES),
    ...enumFilters("category", query, REPORT_CATEGORIES),
    ...numericIdFilter(query)
  ]
});

const schoolReportWhere = ({ query, user }) => {
  const base = {
    OR: [
      { message: textContains(query) },
      ...enumFilters("category", query, REPORT_CATEGORIES),
      {
        school: {
          deletedAt: null,
          name: textContains(query)
        }
      },
      {
        school: {
          deletedAt: null,
          city: textContains(query)
        }
      },
      ...numericIdFilter(query)
    ],
    school: {
      deletedAt: null
    }
  };

  if (isAdminScoped(user)) return base;

  if (user.role === "sekolah" && user.schoolId) {
    return {
      ...base,
      schoolId: user.schoolId
    };
  }

  return null;
};

const issueReportWhere = ({ query, user }) => {
  const base = {
    deletedAt: null,
    sppg: {
      deletedAt: null
    },
    OR: [
      { description: textContains(query) },
      ...enumFilters("category", query, ISSUE_CATEGORIES),
      ...enumFilters("status", query, ISSUE_STATUSES),
      {
        sppg: {
          deletedAt: null,
          name: textContains(query)
        }
      },
      ...numericIdFilter(query)
    ]
  };

  if (isAdminScoped(user)) return base;

  if (user.role === "sppg" && user.sppgId) {
    return {
      ...base,
      sppgId: user.sppgId
    };
  }

  return null;
};

const searchSppg = async ({ query, user, limit }) => {
  const where = matchSppgWhere({ query, user });
  if (!where) return [];

  const rows = await prisma.sppg.findMany({
    where,
    take: limit,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      status: true
    }
  });

  return rows.map((row) =>
    createResult({
      id: row.id,
      entity: "sppg",
      title: row.name,
      subtitle: [row.city, row.province, row.status].filter(Boolean).join(" - "),
      url: `/peta?sppgId=${row.id}`,
      meta: {
        status: row.status,
        city: row.city,
        province: row.province
      }
    })
  );
};

const searchSchools = async ({ query, user, limit }) => {
  const where = matchSchoolWhere({ query, user });
  if (!where) return [];

  const rows = await prisma.school.findMany({
    where,
    take: limit,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      npsn: true,
      city: true,
      province: true,
      sppg: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return rows.map((row) =>
    createResult({
      id: row.id,
      entity: "school",
      title: row.name,
      subtitle: [row.city, row.province, row.npsn ? `NPSN ${row.npsn}` : null].filter(Boolean).join(" - "),
      url: `/dashboard/master-data?schoolId=${row.id}`,
      meta: {
        npsn: row.npsn,
        city: row.city,
        province: row.province,
        sppgId: row.sppg?.id || null,
        sppgName: row.sppg?.name || null
      }
    })
  );
};

const searchDistributions = async ({ query, user, limit }) => {
  const where = matchDistributionWhere({ query, user });
  if (!where) return [];

  const rows = await prisma.distribution.findMany({
    where,
    take: limit,
    orderBy: [{ distributionDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      portions: true,
      distributionDate: true,
      school: {
        select: {
          id: true,
          name: true,
          city: true
        }
      },
      sppg: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return rows.map((row) =>
    createResult({
      id: row.id,
      entity: "distribution",
      title: `Distribusi #${row.id}`,
      subtitle: [row.school?.name, `${row.portions} porsi`, row.status, formatDate(row.distributionDate)].filter(Boolean).join(" - "),
      url: `/distribusi?distributionId=${row.id}`,
      meta: {
        status: row.status,
        portions: row.portions,
        distributionDate: formatDate(row.distributionDate),
        schoolId: row.school?.id || null,
        schoolName: row.school?.name || null,
        sppgId: row.sppg?.id || null,
        sppgName: row.sppg?.name || null
      }
    })
  );
};

const searchReports = async ({ query, user, limit }) => {
  const tasks = [];

  if (isAdminScoped(user)) {
    tasks.push(
      prisma.publicReport.findMany({
        where: publicReportWhere(query),
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          category: true,
          status: true,
          province: true,
          city: true,
          createdAt: true
        }
      }),
      prisma.schoolReport.findMany({
        where: schoolReportWhere({ query, user }),
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          category: true,
          createdAt: true,
          school: {
            select: {
              id: true,
              name: true,
              city: true
            }
          }
        }
      })
    );
  } else {
    tasks.push(Promise.resolve([]), Promise.resolve([]));
  }

  const schoolReportFilter = !isAdminScoped(user) ? schoolReportWhere({ query, user }) : null;
  if (schoolReportFilter) {
    tasks[1] = prisma.schoolReport.findMany({
      where: schoolReportFilter,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        category: true,
        createdAt: true,
        school: {
          select: {
            id: true,
            name: true,
            city: true
          }
        }
      }
    });
  }

  const issueFilter = issueReportWhere({ query, user });
  const issueTask = issueFilter
    ? prisma.issue.findMany({
        where: issueFilter,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          category: true,
          status: true,
          createdAt: true,
          sppg: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    : Promise.resolve([]);

  const [publicReports, schoolReports, issues] = await Promise.all([...tasks, issueTask]);

  return [
    ...publicReports.map((row) =>
      createResult({
        id: `public-${row.id}`,
        entity: "public_report",
        title: `Laporan masyarakat #${row.id}`,
        subtitle: [row.category, row.status, row.city, row.province].filter(Boolean).join(" - "),
        url: `/laporan-masyarakat?reportId=${row.id}`,
        meta: {
          source: "public_report",
          category: row.category,
          status: row.status,
          createdAt: row.createdAt.toISOString()
        }
      })
    ),
    ...schoolReports.map((row) =>
      createResult({
        id: `school-${row.id}`,
        entity: "school_report",
        title: `Laporan sekolah #${row.id}`,
        subtitle: [row.school?.name, row.category, formatDate(row.createdAt)].filter(Boolean).join(" - "),
        url: `/dashboard/laporan-sekolah?reportId=${row.id}`,
        meta: {
          source: "school_report",
          category: row.category,
          schoolId: row.school?.id || null,
          schoolName: row.school?.name || null,
          createdAt: row.createdAt.toISOString()
        }
      })
    ),
    ...issues.map((row) =>
      createResult({
        id: `issue-${row.id}`,
        entity: "issue",
        title: `Kendala SPPG #${row.id}`,
        subtitle: [row.sppg?.name, row.category, row.status].filter(Boolean).join(" - "),
        url: `/dashboard/kendala?issueId=${row.id}`,
        meta: {
          source: "issue",
          category: row.category,
          status: row.status,
          sppgId: row.sppg?.id || null,
          sppgName: row.sppg?.name || null,
          createdAt: row.createdAt.toISOString()
        }
      })
    )
  ].slice(0, limit);
};

const search = async ({ query = {}, user }) => {
  const q = String(query.q || "").trim();
  const limit = Number(query.limit || 5);

  if (q.length < 2) {
    return {
      data: EMPTY_RESULTS,
      meta: {
        q,
        limit,
        minLength: 2
      }
    };
  }

  const [sppg, schools, distributions, reports] = await Promise.all([
    searchSppg({ query: q, user, limit }),
    searchSchools({ query: q, user, limit }),
    searchDistributions({ query: q, user, limit }),
    searchReports({ query: q, user, limit })
  ]);

  return {
    data: {
      sppg,
      schools,
      distributions,
      reports
    },
    meta: {
      q,
      limit,
      total:
        sppg.length +
        schools.length +
        distributions.length +
        reports.length
    }
  };
};

module.exports = {
  search
};
