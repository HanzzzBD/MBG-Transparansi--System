const { getPrismaClient } = require("../../config/prisma");
const {
  buildLooseTokenSearchWhere,
  buildTokenSearchOr,
  getRankedSearchCandidateLimit,
  mergeWhereWithAnd,
  rankBySearch,
  textContains,
} = require("../../utils/search");

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

const numericIdFilter = (query) => (Number.isInteger(Number(query)) ? [{ id: Number(query) }] : []);

const enumFilters = (field, query, values) => {
  const normalizedQuery = String(query || "").toLowerCase();

  return values
    .filter((value) => value.includes(normalizedQuery))
    .map((value) => ({
      [field]: value
    }));
};

const createResult = ({ id, entity, title, subtitle, url, meta = {}, searchText }) => ({
  id: String(id),
  entity,
  title,
  subtitle,
  url,
  searchText,
  meta
});

const formatDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : null);

const SEARCH_MODE = "partial_fuzzy_ranked";
const searchOrWhere = (conditions) => {
  const filtered = conditions.filter(Boolean);
  if (filtered.length === 0) return {};
  return filtered.length === 1 ? filtered[0] : { OR: filtered };
};
const maybeWhere = (condition) => (condition && Object.keys(condition).length ? [condition] : []);

const buildLooseNestedSearchWhere = (query, builders = []) => {
  return buildTokenSearchOr(query, builders);
};

const matchSppgWhere = ({ query, user }) => {
  const base = {
    deletedAt: null,
    ...(() => {
      const searchWhere = buildTokenSearchOr(query, [
        (token) => ({ name: textContains(token) }),
        (token) => ({ province: textContains(token) }),
        (token) => ({ city: textContains(token) }),
        (token) => ({ address: textContains(token) })
      ]);
      const searchOr = [...maybeWhere(searchWhere), ...numericIdFilter(query)];
      return searchOrWhere(searchOr);
    })()
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
    ...(() => {
      const searchWhere = buildTokenSearchOr(query, [
        (token) => ({ name: textContains(token) }),
        (token) => ({ npsn: textContains(token) }),
        (token) => ({ city: textContains(token) }),
        (token) => ({ district: textContains(token) }),
        (token) => ({ province: textContains(token) })
      ]);
      const searchOr = [...maybeWhere(searchWhere), ...numericIdFilter(query)];
      return searchOrWhere(searchOr);
    })()
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
  const searchWhere = buildTokenSearchOr(query, [
    (token) => ({
      sppg: {
        deletedAt: null,
        name: textContains(token)
      }
    }),
    (token) => ({
      school: {
        deletedAt: null,
        name: textContains(token)
      }
    }),
    (token) => ({
      school: {
        deletedAt: null,
        city: textContains(token)
      }
    })
  ]);
  const searchOr = [...maybeWhere(searchWhere), ...numericIdFilter(query)];
  const base = {
    school: {
      deletedAt: null
    },
    sppg: {
      deletedAt: null
    },
    ...searchOrWhere(searchOr)
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
  ...(() => {
    const searchWhere = buildTokenSearchOr(query, [
      (token) => ({ message: textContains(token) }),
      (token) => ({ province: textContains(token) }),
      (token) => ({ city: textContains(token) })
    ]);
    const searchOr = [
      ...maybeWhere(searchWhere),
    ...enumFilters("status", query, PUBLIC_REPORT_STATUSES),
    ...enumFilters("category", query, REPORT_CATEGORIES),
    ...numericIdFilter(query)
    ];
    return searchOrWhere(searchOr);
  })()
});

const schoolReportWhere = ({ query, user }) => {
  const searchWhere = buildTokenSearchOr(query, [
    (token) => ({ message: textContains(token) }),
    (token) => ({
      school: {
        deletedAt: null,
        name: textContains(token)
      }
    }),
    (token) => ({
      school: {
        deletedAt: null,
        city: textContains(token)
      }
    })
  ]);
  const searchOr = [
    ...maybeWhere(searchWhere),
    ...enumFilters("category", query, REPORT_CATEGORIES),
    ...numericIdFilter(query)
  ];
  const base = {
    ...searchOrWhere(searchOr),
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
  const searchWhere = buildTokenSearchOr(query, [
    (token) => ({ description: textContains(token) }),
    (token) => ({
      sppg: {
        deletedAt: null,
        name: textContains(token)
      }
    })
  ]);
  const searchOr = [
    ...maybeWhere(searchWhere),
    ...enumFilters("category", query, ISSUE_CATEGORIES),
    ...enumFilters("status", query, ISSUE_STATUSES),
    ...numericIdFilter(query)
  ];
  const base = {
    deletedAt: null,
    sppg: {
      deletedAt: null
    },
    ...searchOrWhere(searchOr)
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
  const candidateLimit = getRankedSearchCandidateLimit({ page: 1, limit });
  const baseWhere = matchSppgWhere({ query: "", user });
  const candidateWhere = mergeWhereWithAnd(
    baseWhere,
    buildLooseTokenSearchWhere(query, ["name", "province", "city", "address"])
  );

  let rows = await prisma.sppg.findMany({
    where: candidateWhere,
    take: candidateLimit,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      address: true,
      status: true
    }
  });

  rows = rankBySearch(rows, query, [
    { field: "name", weight: 7 },
    { field: "city", weight: 3 },
    { field: "province", weight: 2 },
    { field: "address", weight: 1 },
    { field: "status", weight: 0.5 }
  ]).slice(0, limit);

  if (!rows.length && where !== candidateWhere) {
    rows = await prisma.sppg.findMany({
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
  }

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
  const candidateLimit = getRankedSearchCandidateLimit({ page: 1, limit });
  const baseWhere = matchSchoolWhere({ query: "", user });
  const candidateWhere = mergeWhereWithAnd(
    baseWhere,
    buildLooseTokenSearchWhere(query, ["name", "npsn", "city", "district", "province", "educationLevel", "schoolStatus"])
  );

  let rows = await prisma.school.findMany({
    where: candidateWhere,
    take: candidateLimit,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      npsn: true,
      province: true,
      city: true,
      district: true,
      educationLevel: true,
      schoolStatus: true,
      sppg: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  rows = rankBySearch(rows, query, [
    { field: "name", weight: 7 },
    { field: "npsn", weight: 4 },
    { field: "city", weight: 3 },
    { field: "district", weight: 2 },
    { field: "province", weight: 2 },
    { field: "educationLevel", weight: 1 },
    { field: "schoolStatus", weight: 1 },
    { value: (row) => row.sppg?.name, weight: 1 }
  ]).slice(0, limit);

  if (rows.length < limit) {
    const strictRows = await prisma.school.findMany({
      where,
      take: limit,
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        npsn: true,
        city: true,
        district: true,
        province: true,
        educationLevel: true,
        schoolStatus: true,
        sppg: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    const knownIds = new Set(rows.map((row) => row.id));
    rows = [...rows, ...strictRows.filter((row) => !knownIds.has(row.id))].slice(0, limit);
  }

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
  const candidateLimit = getRankedSearchCandidateLimit({ page: 1, limit });
  const baseWhere = matchDistributionWhere({ query: "", user });
  const candidateWhere = mergeWhereWithAnd(
    baseWhere,
    buildLooseNestedSearchWhere(query, [
      (token) => ({
        sppg: {
          deletedAt: null,
          name: textContains(token)
        }
      }),
      (token) => ({
        school: {
          deletedAt: null,
          name: textContains(token)
        }
      }),
      (token) => ({
        school: {
          deletedAt: null,
          city: textContains(token)
        }
      })
    ])
  );

  let rows = await prisma.distribution.findMany({
    where: candidateWhere,
    take: candidateLimit,
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

  rows = rankBySearch(rows, query, [
    { value: (row) => row.school?.name, weight: 7 },
    { value: (row) => row.sppg?.name, weight: 5 },
    { value: (row) => row.school?.city, weight: 3 },
    { field: "status", weight: 2 },
    { field: "id", weight: 0.25 }
  ]).slice(0, limit);

  if (rows.length < limit) {
    const strictRows = await prisma.distribution.findMany({
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
    const knownIds = new Set(rows.map((row) => row.id));
    rows = [...rows, ...strictRows.filter((row) => !knownIds.has(row.id))].slice(0, limit);
  }

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
  const candidateLimit = getRankedSearchCandidateLimit({ page: 1, limit });

  if (isAdminScoped(user)) {
    const publicBaseWhere = publicReportWhere("");
    const publicCandidateWhere = mergeWhereWithAnd(
      publicBaseWhere,
      buildLooseTokenSearchWhere(query, ["message", "province", "city"])
    );
    const schoolBaseWhere = schoolReportWhere({ query: "", user });
    const schoolCandidateWhere = mergeWhereWithAnd(
      schoolBaseWhere,
      buildLooseNestedSearchWhere(query, [
        (token) => ({ message: textContains(token) }),
        (token) => ({
          school: {
            deletedAt: null,
            name: textContains(token)
          }
        }),
        (token) => ({
          school: {
            deletedAt: null,
            city: textContains(token)
          }
        })
      ])
    );

    tasks.push(
      prisma.publicReport.findMany({
        where: publicCandidateWhere,
        take: candidateLimit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          category: true,
          status: true,
          province: true,
          city: true,
          message: true,
          createdAt: true
        }
      }),
      prisma.schoolReport.findMany({
        where: schoolCandidateWhere,
        take: candidateLimit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          category: true,
          message: true,
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

  const schoolReportFilter = !isAdminScoped(user) ? schoolReportWhere({ query: "", user }) : null;
  if (schoolReportFilter) {
    const schoolCandidateWhere = mergeWhereWithAnd(
      schoolReportFilter,
      buildLooseNestedSearchWhere(query, [
        (token) => ({ message: textContains(token) }),
        (token) => ({
          school: {
            deletedAt: null,
            name: textContains(token)
          }
        }),
        (token) => ({
          school: {
            deletedAt: null,
            city: textContains(token)
          }
        })
      ])
    );
    tasks[1] = prisma.schoolReport.findMany({
      where: schoolCandidateWhere,
      take: candidateLimit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        category: true,
        message: true,
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

  const issueFilter = issueReportWhere({ query: "", user });
  const issueCandidateWhere = issueFilter
    ? mergeWhereWithAnd(
        issueFilter,
        buildLooseNestedSearchWhere(query, [
          (token) => ({ description: textContains(token) }),
          (token) => ({
            sppg: {
              deletedAt: null,
              name: textContains(token)
            }
          })
        ])
      )
    : null;
  const issueTask = issueFilter
    ? prisma.issue.findMany({
        where: issueCandidateWhere,
        take: candidateLimit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          category: true,
          status: true,
          description: true,
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

  return rankBySearch([
    ...publicReports.map((row) =>
      createResult({
        id: `public-${row.id}`,
        entity: "public_report",
        title: `Laporan masyarakat #${row.id}`,
        subtitle: [row.category, row.status, row.city, row.province].filter(Boolean).join(" - "),
        url: `/laporan-masyarakat?reportId=${row.id}`,
        searchText: row.message,
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
        searchText: row.message,
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
        searchText: row.description,
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
  ], query, [
    { field: "title", weight: 6 },
    { field: "searchText", weight: 5 },
    { field: "subtitle", weight: 3 },
    { value: (item) => item.meta?.category, weight: 3 },
    { value: (item) => item.meta?.status, weight: 2 },
    { value: (item) => item.meta?.schoolName, weight: 3 },
    { value: (item) => item.meta?.sppgName, weight: 3 }
  ]).slice(0, limit).map(({ searchText, ...item }) => item);
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
      searchMode: SEARCH_MODE,
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
