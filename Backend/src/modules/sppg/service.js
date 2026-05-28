const { Prisma } = require("@prisma/client");

const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const {
  buildLooseTokenSearchWhere,
  buildRankedSearchCandidateWhere,
  buildTokenSearchWhere,
  getRankedSearchCandidateLimit,
  hasSearchQuery,
  paginateRankedSearch,
  rankBySearch,
  tokenizeSearch
} = require("../../utils/search");

const prisma = getPrismaClient();
const SPPG_STATUS_VALUES = new Set(["active", "inactive", "problem"]);

const normalizeSppgStatus = (status) => (SPPG_STATUS_VALUES.has(status) ? status : "active");

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const toDateOnly = (value = new Date()) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

const buildSppgSqlSearchConditions = (query = {}) =>
  tokenizeSearch(query.search).map((token) => {
    const search = `%${token}%`;
    return Prisma.sql`(s.name ILIKE ${search} OR s.province ILIKE ${search} OR s.city ILIKE ${search} OR s.address ILIKE ${search})`;
  });

const buildSppgWhere = (query = {}) => ({
  deletedAt: null,
  ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
  ...buildTokenSearchWhere(query.search, ["name", "province", "city", "address"]),
  ...(query.status ? { status: query.status } : {})
});

const buildDeletedSppgWhere = (query = {}) => {
  const { deletedAt, ...activeWhere } = buildSppgWhere(query);
  return {
    ...activeWhere,
    deletedAt: {
      not: null
    }
  };
};

const buildSppgBaseWhere = (query = {}) =>
  buildSppgWhere({
    ...query,
    search: undefined
  });

const SPPG_SEARCH_FIELDS = ["name", "province", "city", "address"];
const SPPG_SEARCH_RANK_FIELDS = [
  { field: "name", weight: 7 },
  { field: "city", weight: 3 },
  { field: "province", weight: 2 },
  { field: "address", weight: 1 },
  { field: "status", weight: 0.5 }
];

const buildSppgSelect = (fields) => {
  if (!fields) {
    return undefined;
  }

  const requestedFields = fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  const allowedFields = new Set(["lat", "lng", "status", "province", "city", "address", "capacity"]);
  const select = {
    id: true,
    name: true
  };

  requestedFields.forEach((field) => {
    if (allowedFields.has(field)) {
      select[field] = true;
    }
  });

  return select;
};

const getActiveSppgById = async (id) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const getDeletedSppgById = async (id) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: {
        not: null
      }
    }
  });

  if (!sppg) {
    throw new AppError("Deleted SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const buildMapMarkerSqlWhere = (query = {}) => {
  const conditions = [Prisma.sql`s.deleted_at IS NULL`, Prisma.sql`s.lat IS NOT NULL`, Prisma.sql`s.lng IS NOT NULL`];

  if (query.province) {
    conditions.push(Prisma.sql`s.province ILIKE ${`%${query.province}%`}`);
  }

  if (query.city) {
    conditions.push(Prisma.sql`s.city ILIKE ${`%${query.city}%`}`);
  }

  conditions.push(...buildSppgSqlSearchConditions(query));

  if (query.status) {
    conditions.push(Prisma.sql`s.status = ${query.status}::"SppgStatus"`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
};

const listSppg = async ({ query }) => {
  const pagination = query.all ? null : parsePagination(query);
  const where = buildSppgWhere(query);
  const select = buildSppgSelect(query.fields);

  if (hasSearchQuery(query.search)) {
    const baseWhere = buildSppgBaseWhere(query);
    const candidateLimit = pagination ? getRankedSearchCandidateLimit(pagination) : 5000;
    let candidates = await prisma.sppg.findMany({
      where: buildRankedSearchCandidateWhere(baseWhere, query.search, SPPG_SEARCH_FIELDS),
      ...(select ? { select } : {}),
      take: candidateLimit,
      orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }]
    });

    const ranked = pagination
      ? paginateRankedSearch({
          items: candidates,
          query: query.search,
          fieldConfigs: SPPG_SEARCH_RANK_FIELDS,
          pagination
        })
      : (() => {
          const rankedItems = rankBySearch(candidates, query.search, SPPG_SEARCH_RANK_FIELDS);
          return { items: rankedItems, total: rankedItems.length };
        })();

    return {
      data: ranked.items,
      meta: pagination
        ? {
            ...buildPaginationMeta({
              page: pagination.page,
              limit: pagination.limit,
              total: ranked.total
            }),
            searchMode: "partial_fuzzy_ranked"
          }
        : {
            page: 1,
            limit: ranked.total,
            total: ranked.total,
            totalPages: ranked.total === 0 ? 0 : 1,
            all: true,
            searchMode: "partial_fuzzy_ranked"
          }
    };
  }

  const [items, total] = await Promise.all([
    prisma.sppg.findMany({
      where,
      ...(select ? { select } : {}),
      ...(pagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }]
    }),
    prisma.sppg.count({ where })
  ]);

  return {
    data: items,
    meta: pagination
      ? buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total
        })
      : {
          page: 1,
          limit: total,
          total,
          totalPages: total === 0 ? 0 : 1,
          all: true
        }
  };
};

const listDeletedSppg = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = buildDeletedSppgWhere(query);

  if (hasSearchQuery(query.search)) {
    const baseWhere = buildDeletedSppgWhere({
      ...query,
      search: undefined
    });
    const candidateLimit = getRankedSearchCandidateLimit(pagination);
    let candidates = await prisma.sppg.findMany({
      where: buildRankedSearchCandidateWhere(baseWhere, query.search, SPPG_SEARCH_FIELDS),
      take: candidateLimit,
      orderBy: [{ deletedAt: "desc" }, { province: "asc" }, { city: "asc" }, { name: "asc" }]
    });

    const ranked = paginateRankedSearch({
      items: candidates,
      query: query.search,
      fieldConfigs: SPPG_SEARCH_RANK_FIELDS,
      pagination
    });

    return {
      data: ranked.items,
      meta: {
        ...buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: ranked.total
        }),
        searchMode: "partial_fuzzy_ranked"
      }
    };
  }

  const [items, total] = await Promise.all([
    prisma.sppg.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ deletedAt: "desc" }, { province: "asc" }, { city: "asc" }, { name: "asc" }]
    }),
    prisma.sppg.count({ where })
  ]);

  return {
    data: items,
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const listMapMarkers = async ({ query = {} }) => {
  const today = toDateOnly();
  const whereSql = buildMapMarkerSqlWhere(query);

  const rows = await prisma.$queryRaw`
    SELECT
      s.id,
      s.name,
      s.status::text AS status,
      s.lat,
      s.lng,
      s.province,
      s.city,
      COALESCE(
        ROUND(
          100.0 * COUNT(v.id) FILTER (WHERE v.status = 'verified')
          / NULLIF(COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict', 'issue_reported')), 0),
          1
        ),
        0
      ) AS success_rate,
      COALESCE(
        SUM(d.portions) FILTER (WHERE d.distribution_date = ${today}),
        0
      )::int AS porsi_hari_ini
    FROM sppg s
    LEFT JOIN distributions d ON d.sppg_id = s.id
    LEFT JOIN schools sc ON sc.id = d.school_id AND sc.deleted_at IS NULL
    LEFT JOIN validations v ON v.distribution_id = d.id
    ${whereSql}
    GROUP BY s.id
    ORDER BY s.province ASC, s.city ASC, s.name ASC
  `;

  return {
    data: normalizeRows(rows).map((row) => ({
      id: row.id,
      name: row.name,
      status: normalizeSppgStatus(row.status),
      lat: toNumber(row.lat),
      lng: toNumber(row.lng),
      province: row.province,
      city: row.city,
      successRate: toNumber(row.success_rate),
      porsiHariIni: toNumber(row.porsi_hari_ini)
    }))
  };
};

const serializeAssignedSchool = (school) => ({
  assignmentId: school.assignmentId,
  schoolId: school.schoolId ?? school.id,
  id: school.schoolId ?? school.id,
  dapodikSchoolId: school.dapodikSchoolId ?? null,
  name: school.name,
  province: school.province,
  city: school.city,
  district: school.district,
  address: school.address,
  npsn: school.npsn,
  totalStudents: school.totalStudents,
  total_students: school.totalStudents,
  assignmentStatus: school.assignmentStatus || "active",
  assignedAt: school.assignedAt,
  unassignedAt: school.unassignedAt || null,
  notes: school.notes || null
});

const buildAssignedSchoolsWhere = ({ sppgId, query = {} }) => ({
  sppgId: Number(sppgId),
  ...(query.status && query.status !== "all" ? { status: query.status } : { status: "active" }),
  school: {
    deletedAt: null,
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
    ...buildTokenSearchWhere(query.search, ["name", "city", "province", "npsn"])
  }
});

const buildAssignedSchoolsBaseWhere = ({ sppgId, query = {} }) =>
  buildAssignedSchoolsWhere({
    sppgId,
    query: {
      ...query,
      search: undefined
    }
  });

const ASSIGNED_SCHOOL_SEARCH_FIELDS = ["name", "city", "province", "district", "npsn"];
const ASSIGNED_SCHOOL_RANK_FIELDS = [
  { value: (item) => item.school?.name, weight: 7 },
  { value: (item) => item.school?.npsn, weight: 4 },
  { value: (item) => item.school?.city, weight: 3 },
  { value: (item) => item.school?.district, weight: 2 },
  { value: (item) => item.school?.province, weight: 2 }
];

const serializeAssignment = (assignment) =>
  serializeAssignedSchool({
    assignmentId: assignment.id,
    schoolId: assignment.school.id,
    dapodikSchoolId: assignment.school.dapodikLink?.dapodikSchoolRecordId ?? null,
    name: assignment.school.name,
    province: assignment.school.province,
    city: assignment.school.city,
    district: assignment.school.district,
    address: assignment.school.address,
    npsn: assignment.school.npsn,
    totalStudents: assignment.school.totalStudents,
    assignmentStatus: assignment.status,
    assignedAt: assignment.assignedAt,
    unassignedAt: assignment.unassignedAt,
    notes: assignment.notes
  });

const listAssignedSchoolsForSppg = async ({ sppgId, query = {} }) => {
  const pagination = parsePagination(query);
  const where = buildAssignedSchoolsWhere({ sppgId, query });
  const include = {
    school: {
      include: {
        dapodikLink: true
      }
    }
  };

  if (hasSearchQuery(query.search)) {
    const baseWhere = buildAssignedSchoolsBaseWhere({ sppgId, query });
    const candidateLimit = getRankedSearchCandidateLimit(pagination);
    let candidates = await prisma.sppgSchoolAssignment.findMany({
      where: {
        ...baseWhere,
        school: {
          ...baseWhere.school,
          ...buildLooseTokenSearchWhere(query.search, ASSIGNED_SCHOOL_SEARCH_FIELDS)
        }
      },
      include,
      take: candidateLimit,
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }]
    });

    const ranked = paginateRankedSearch({
      items: candidates,
      query: query.search,
      fieldConfigs: ASSIGNED_SCHOOL_RANK_FIELDS,
      pagination
    });

    return {
      data: ranked.items.map(serializeAssignment),
      meta: {
        ...buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: ranked.total
        }),
        searchMode: "partial_fuzzy_ranked"
      }
    };
  }

  const [items, total] = await Promise.all([
    prisma.sppgSchoolAssignment.findMany({
      where,
      include,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }]
    }),
    prisma.sppgSchoolAssignment.count({ where })
  ]);

  return {
    data: items.map(serializeAssignment),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const listMySchools = async ({ query = {}, user }) => {
  const sppgId = requireSppgScope(user);
  return listAssignedSchoolsForSppg({ sppgId, query });
};

const buildDapodikSchoolWhere = (query = {}) => ({
  ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
  ...(query.district ? { district: { contains: query.district, mode: "insensitive" } } : {}),
  ...(query.educationLevel || query.education_level
    ? { educationLevel: { contains: query.educationLevel || query.education_level, mode: "insensitive" } }
    : {}),
  ...buildTokenSearchWhere(query.search, ["name", "npsn", "province", "city", "district"])
});

const DAPODIK_ASSIGNMENT_SEARCH_FIELDS = ["name", "npsn", "province", "city", "district", "educationLevel", "schoolStatus"];
const DAPODIK_ASSIGNMENT_RANK_FIELDS = [
  { field: "name", weight: 7 },
  { field: "npsn", weight: 4 },
  { field: "city", weight: 3 },
  { field: "district", weight: 3 },
  { field: "province", weight: 2 },
  { field: "educationLevel", weight: 1.5 },
  { field: "schoolStatus", weight: 1 },
  { field: "dapodikSchoolId", weight: 0.15 }
];

const serializeDapodikSchoolForAssignment = (item, currentSppgId) => {
  const activeAssignment = item.schoolLink?.school?.sppgAssignments?.[0] || null;

  return {
    id: item.id,
    npsn: item.npsn,
    name: item.name,
    province: item.province,
    city: item.city,
    district: item.district,
    educationLevel: item.educationLevel,
    statusSekolah: item.schoolStatus,
    alreadyAssigned: Boolean(activeAssignment),
    assignedToCurrentSppg: Number(activeAssignment?.sppgId) === Number(currentSppgId),
    assignedSppgName: activeAssignment?.sppg?.name || null
  };
};

const listMyDapodikSchools = async ({ query = {}, user }) => {
  const sppgId = requireSppgScope(user);
  const pagination = parsePagination(query);
  const where = buildDapodikSchoolWhere(query);
  const select = {
    id: true,
    dapodikSchoolId: true,
    npsn: true,
    name: true,
    province: true,
    city: true,
    district: true,
    educationLevel: true,
    schoolStatus: true,
    schoolLink: {
      select: {
        school: {
          select: {
            sppgAssignments: {
              where: {
                status: "active"
              },
              select: {
                id: true,
                sppgId: true,
                sppg: {
                  select: {
                    name: true
                  }
                }
              },
              take: 1
            }
          }
        }
      }
    }
  };

  if (query.search) {
    const baseWhere = buildDapodikSchoolWhere({
      ...query,
      search: undefined
    });
    const candidateWhere = {
      ...baseWhere,
      AND: [
        ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : []),
        buildLooseTokenSearchWhere(query.search, DAPODIK_ASSIGNMENT_SEARCH_FIELDS)
      ].filter((condition) => Object.keys(condition).length > 0)
    };
    const candidateLimit = Math.max(500, Math.min(5000, pagination.page * pagination.limit * 30));
    let candidates = await prisma.dapodikSchool.findMany({
      where: candidateWhere,
      select,
      take: candidateLimit,
      orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }]
    });

    const rankedItems = rankBySearch(candidates, query.search, DAPODIK_ASSIGNMENT_RANK_FIELDS);
    const pageItems = rankedItems.slice(pagination.skip, pagination.skip + pagination.limit);

    return {
      data: pageItems.map((item) => serializeDapodikSchoolForAssignment(item, sppgId)),
      meta: {
        ...buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: rankedItems.length
        }),
        searchMode: "partial_fuzzy_ranked"
      }
    };
  }

  const [items, total] = await Promise.all([
    prisma.dapodikSchool.findMany({
      where,
      select,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }]
    }),
    prisma.dapodikSchool.count({ where })
  ]);

  return {
    data: items.map((item) => serializeDapodikSchoolForAssignment(item, sppgId)),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getDapodikSchoolById = async (id, tx = prisma) => {
  const school = await tx.dapodikSchool.findUnique({
    where: {
      id: Number(id)
    }
  });

  if (!school) {
    throw new AppError("Dapodik school not found.", 404, "DAPODIK_SCHOOL_NOT_FOUND");
  }

  if (!school.province || !school.city) {
    throw new AppError("Dapodik school is missing province or city.", 400, "DAPODIK_SCHOOL_REGION_INCOMPLETE");
  }

  return school;
};

const findOperationalSchoolForDapodik = async ({ tx, stagedSchool }) => {
  const linked = await tx.schoolDapodikLink.findUnique({
    where: {
      dapodikSchoolRecordId: stagedSchool.id
    },
    include: {
      school: true
    }
  });

  if (linked?.school) return linked.school;

  if (stagedSchool.npsn) {
    const byNpsn = await tx.school.findUnique({
      where: {
        npsn: stagedSchool.npsn
      }
    });
    if (byNpsn) return byNpsn;
  }

  if (stagedSchool.dapodikSchoolId) {
    const byDapodikId = await tx.school.findUnique({
      where: {
        dapodikSchoolId: stagedSchool.dapodikSchoolId
      }
    });
    if (byDapodikId) return byDapodikId;
  }

  return null;
};

const ensureOperationalSchoolFromDapodik = async ({ tx, stagedSchool, sppgId, actorUserId }) => {
  const existing = await findOperationalSchoolForDapodik({ tx, stagedSchool });

  if (existing) {
    const updated = await tx.school.update({
      where: {
        id: existing.id
      },
      data: {
        name: stagedSchool.name.trim(),
        province: stagedSchool.province.trim(),
        city: stagedSchool.city.trim(),
        district: stagedSchool.district,
        sppgId: Number(sppgId),
        totalStudents: stagedSchool.studentCount ?? existing.totalStudents ?? 0,
        npsn: stagedSchool.npsn,
        dapodikSchoolId: stagedSchool.dapodikSchoolId,
        educationLevel: stagedSchool.educationLevel,
        schoolStatus: stagedSchool.schoolStatus,
        dapodikSyncedAt: stagedSchool.lastSyncAt,
        deletedAt: null
      }
    });

    await tx.schoolDapodikLink.upsert({
      where: {
        schoolId: updated.id
      },
      create: {
        schoolId: updated.id,
        dapodikSchoolRecordId: stagedSchool.id,
        linkedBy: actorUserId
      },
      update: {
        dapodikSchoolRecordId: stagedSchool.id,
        linkedBy: actorUserId
      }
    });

    return updated;
  }

  const created = await tx.school.create({
    data: {
      name: stagedSchool.name.trim(),
      province: stagedSchool.province.trim(),
      city: stagedSchool.city.trim(),
      district: stagedSchool.district,
      address: null,
      sppgId: Number(sppgId),
      totalStudents: stagedSchool.studentCount ?? 0,
      npsn: stagedSchool.npsn,
      dapodikSchoolId: stagedSchool.dapodikSchoolId,
      educationLevel: stagedSchool.educationLevel,
      schoolStatus: stagedSchool.schoolStatus,
      dapodikSyncedAt: stagedSchool.lastSyncAt,
      dapodikLink: {
        create: {
          dapodikSchoolRecordId: stagedSchool.id,
          linkedBy: actorUserId
        }
      }
    }
  });

  return created;
};

const normalizeDapodikIds = (payload) => {
  const ids = payload.dapodikSchoolIds?.length ? payload.dapodikSchoolIds : [payload.dapodikSchoolId];
  return [...new Set(ids.map(Number).filter(Boolean))].slice(0, 50);
};

const assignSchoolsToSppg = async ({ sppgId, payload, user, ipAddress }) => {
  const targetSppgId = user.role === "sppg" ? requireSppgScope(user) : Number(sppgId);
  await getActiveSppgById(targetSppgId);

  const dapodikSchoolIds = normalizeDapodikIds(payload);
  const notes = payload.notes || null;

  const results = await prisma.$transaction(async (tx) => {
    const output = [];

    for (const dapodikSchoolId of dapodikSchoolIds) {
      const stagedSchool = await getDapodikSchoolById(dapodikSchoolId, tx);
      const existingSchool = await findOperationalSchoolForDapodik({ tx, stagedSchool });
      const activeAssignment = existingSchool
        ? await tx.sppgSchoolAssignment.findFirst({
            where: {
              schoolId: existingSchool.id,
              status: "active"
            },
            include: {
              sppg: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          })
        : null;

      if (activeAssignment && Number(activeAssignment.sppgId) === Number(targetSppgId)) {
        output.push({
          dapodikSchoolId,
          schoolId: existingSchool.id,
          assignmentId: activeAssignment.id,
          status: "skipped_already_assigned",
          reason: "School is already assigned to this SPPG."
        });
        continue;
      }

      if (activeAssignment) {
        output.push({
          dapodikSchoolId,
          schoolId: existingSchool.id,
          status: "skipped_already_assigned",
          reason: `School is already assigned to ${activeAssignment.sppg.name}.`
        });
        continue;
      }

      const school = await ensureOperationalSchoolFromDapodik({
        tx,
        stagedSchool,
        sppgId: targetSppgId,
        actorUserId: user.userId
      });

      const assignment = await tx.sppgSchoolAssignment.create({
        data: {
          sppgId: Number(targetSppgId),
          schoolId: school.id,
          assignedBy: user.userId,
          status: "active",
          notes
        },
        include: {
          school: {
            include: {
              dapodikLink: true
            }
          }
        }
      });

      await createAuditLog({
        prisma: tx,
        userId: user.userId,
        action: "INSERT",
        tableName: "sppg_school_assignments",
        recordId: assignment.id,
        newData: assignment,
        ipAddress
      });

      output.push({
        dapodikSchoolId,
        schoolId: school.id,
        assignmentId: assignment.id,
        status: "assigned",
        assignment: serializeAssignment(assignment)
      });
    }

    return output;
  });

  return {
    data: results,
    meta: {
      assigned: results.filter((item) => item.status === "assigned").length,
      skipped: results.filter((item) => item.status !== "assigned").length
    }
  };
};

const unassignSchoolFromSppg = async ({ sppgId, assignmentId, payload = {}, user, ipAddress }) => {
  const targetSppgId = user.role === "sppg" ? requireSppgScope(user) : Number(sppgId);
  const assignment = await prisma.sppgSchoolAssignment.findFirst({
    where: {
      id: Number(assignmentId),
      sppgId: Number(targetSppgId),
      status: "active"
    },
    include: {
      school: true
    }
  });

  if (!assignment) {
    throw new AppError("Active school assignment not found.", 404, "SCHOOL_ASSIGNMENT_NOT_FOUND");
  }

  const activeDistributionCount = await prisma.distribution.count({
    where: {
      sppgId: Number(targetSppgId),
      schoolId: assignment.schoolId,
      status: "in_progress"
    }
  });

  if (activeDistributionCount > 0) {
    throw new AppError(
      "School still has active distributions and cannot be unassigned.",
      409,
      "SCHOOL_ASSIGNMENT_HAS_ACTIVE_DISTRIBUTIONS"
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.sppgSchoolAssignment.update({
      where: {
        id: assignment.id
      },
      data: {
        status: "inactive",
        unassignedAt: new Date(),
        notes: payload.reason || assignment.notes || null
      },
      include: {
        school: {
          include: {
            dapodikLink: true
          }
        }
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "sppg_school_assignments",
      recordId: next.id,
      oldData: assignment,
      newData: next,
      ipAddress
    });

    return next;
  });

  return {
    data: serializeAssignment(updated)
  };
};

const getSppgDetail = async ({ id }) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    include: {
      menus: {
        where: {
          deletedAt: null
        },
        orderBy: [{ menuDate: "desc" }, { createdAt: "desc" }],
        take: 1
      }
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  const [activeAssignments, distributionStats, activeIssueCount, totalDistributionCount] =
    await Promise.all([
    prisma.sppgSchoolAssignment.findMany({
      where: {
        sppgId: sppg.id,
        status: "active",
        school: {
          deletedAt: null
        }
      },
      select: {
        school: {
          select: {
            totalStudents: true
          }
        }
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
    prisma.issue.count({
      where: {
        sppgId: sppg.id,
        deletedAt: null
      }
    }),
    prisma.distribution.count({
      where: {
        sppgId: sppg.id
      }
    })
  ]);

  const stats = distributionStats.reduce(
    (accumulator, item) => {
      accumulator[item.status] = item._count._all;
      return accumulator;
    },
    {
      in_progress: 0,
      delivered: 0,
      failed: 0
    }
  );

  return {
    data: {
      ...sppg,
      latestMenu: sppg.menus[0] || null,
      stats: {
        totalSchools: activeAssignments.length,
        totalStudents: activeAssignments.reduce((total, item) => total + toNumber(item.school?.totalStudents), 0),
        totalDistributions: totalDistributionCount,
        totalIssues: activeIssueCount,
        distributionsByStatus: stats
      }
    }
  };
};

const serializeMenu = (menu) =>
  menu
    ? {
        id: menu.id,
        menuDate: menu.menuDate,
        menuName: menu.menuName,
        calories: menu.calories,
        proteinG: menu.proteinG,
        carbsG: menu.carbsG,
        fatG: menu.fatG
      }
    : null;

const serializeProductionBatch = (batch) =>
  batch
    ? {
        id: batch.id,
        productionDate: batch.productionDate,
        totalPortions: batch.totalPortions,
        totalCost: toNumber(batch.totalCost),
        costPerPortion: toNumber(batch.costPerPortion),
        menu: serializeMenu(batch.menu)
      }
    : null;

const serializeDistribution = (distribution) => ({
  id: distribution.id,
  portions: distribution.portions,
  pricePerPortion: toNumber(distribution.pricePerPortion),
  totalCost: toNumber(distribution.totalCost),
  distributionDate: distribution.distributionDate,
  status: distribution.status,
  deliveryStatus: distribution.status,
  confirmationStatus: distribution.validation?.status || "pending",
  failureReason: distribution.failureReason,
  school: distribution.school
    ? {
        id: distribution.school.id,
        name: distribution.school.name,
        province: distribution.school.province,
        city: distribution.school.city
      }
    : null,
  validation: distribution.validation
    ? {
        id: distribution.validation.id,
        status: distribution.validation.status,
        receivedPortions: distribution.validation.receivedPortions,
        qualityOk: distribution.validation.qualityOk,
        validatedAt: distribution.validation.validatedAt
      }
    : null
});

const serializeAnomaly = (anomaly) => ({
  id: anomaly.id,
  anomalyType: anomaly.anomalyType,
  description: anomaly.description,
  createdAt: anomaly.createdAt,
  isResolved: anomaly.isResolved,
  distribution: anomaly.distribution
    ? {
        id: anomaly.distribution.id,
        status: anomaly.distribution.status,
        distributionDate: anomaly.distribution.distributionDate,
        school: anomaly.distribution.school
          ? {
              id: anomaly.distribution.school.id,
              name: anomaly.distribution.school.name
            }
          : null
      }
    : null,
  productionBatch: anomaly.productionBatch
    ? {
        id: anomaly.productionBatch.id,
        productionDate: anomaly.productionBatch.productionDate
      }
    : null
});

const getSppgOperationalDetail = async ({ id }) => {
  const sppgId = Number(id);
  const today = toDateOnly();

  const sppg = await prisma.sppg.findFirst({
    where: {
      id: sppgId,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      address: true,
      lat: true,
      lng: true,
      capacity: true,
      workers: true,
      picName: true,
      picPhone: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  const todayDistributionWhere = {
    sppgId,
    distributionDate: today,
    school: {
      deletedAt: null
    }
  };

  const [
    menuToday,
    productionBatchToday,
    latestDistributions,
    activeAnomalies,
    schoolAgg,
    schoolCount,
    totalDistributionCount,
    todayPortionAgg,
    deliveredToday,
    failedToday,
    pendingValidationCount,
    verifiedCount,
    validatedCount,
    activeAnomalyCount
  ] = await Promise.all([
    prisma.menu.findFirst({
      where: {
        sppgId,
        menuDate: today,
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.productionBatch.findFirst({
      where: {
        sppgId,
        productionDate: today
      },
      include: {
        menu: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.distribution.findMany({
      where: {
        sppgId,
        school: {
          deletedAt: null
        }
      },
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
            validatedAt: true
          }
        }
      },
      orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }],
      take: 7
    }),
    prisma.anomalyLog.findMany({
      where: {
        isResolved: false,
        OR: [
          {
            distribution: {
              sppgId,
              school: {
                deletedAt: null
              }
            }
          },
          {
            productionBatch: {
              sppgId
            }
          }
        ]
      },
      include: {
        distribution: {
          include: {
            school: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        productionBatch: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    }),
    prisma.school.aggregate({
      where: {
        sppgId,
        deletedAt: null
      },
      _sum: {
        totalStudents: true
      }
    }),
    prisma.school.count({
      where: {
        sppgId,
        deletedAt: null
      }
    }),
    prisma.distribution.count({
      where: {
        sppgId,
        school: {
          deletedAt: null
        }
      }
    }),
    prisma.distribution.aggregate({
      where: todayDistributionWhere,
      _sum: {
        portions: true
      }
    }),
    prisma.distribution.count({
      where: {
        ...todayDistributionWhere,
        status: "delivered"
      }
    }),
    prisma.distribution.count({
      where: {
        ...todayDistributionWhere,
        status: "failed"
      }
    }),
    prisma.validation.count({
      where: {
        status: "pending",
        distribution: {
          sppgId,
          school: {
            deletedAt: null
          }
        }
      }
    }),
    prisma.validation.count({
      where: {
        status: "verified",
        distribution: {
          sppgId,
          school: {
            deletedAt: null
          }
        }
      }
    }),
    prisma.validation.count({
      where: {
        status: {
          in: ["verified", "conflict"]
        },
        distribution: {
          sppgId,
          school: {
            deletedAt: null
          }
        }
      }
    }),
    prisma.anomalyLog.count({
      where: {
        isResolved: false,
        OR: [
          {
            distribution: {
              sppgId,
              school: {
                deletedAt: null
              }
            }
          },
          {
            productionBatch: {
              sppgId
            }
          }
        ]
      }
    })
  ]);

  const successRate =
    validatedCount === 0 ? 0 : Number(((verifiedCount / validatedCount) * 100).toFixed(1));

  return {
    data: {
      info: {
        id: sppg.id,
        name: sppg.name,
        address: sppg.address,
        lat: sppg.lat,
        lng: sppg.lng
      },
      id: sppg.id,
      name: sppg.name,
      capacity: sppg.capacity,
      pic: {
        name: sppg.picName,
        phone: sppg.picPhone
      },
      province: sppg.province,
      city: sppg.city,
      status: normalizeSppgStatus(sppg.status),
      isActive: normalizeSppgStatus(sppg.status) === "active",
      workers: sppg.workers,
      menuHariIni: serializeMenu(menuToday || productionBatchToday?.menu || null),
      productionBatchHariIni: serializeProductionBatch(productionBatchToday),
      distribusiTerakhir: latestDistributions.map(serializeDistribution),
      anomalyAktif: activeAnomalies.map(serializeAnomaly),
      kpiSummary: {
        totalSchools: schoolCount,
        totalStudents: schoolAgg._sum.totalStudents || 0,
        totalDistributions: totalDistributionCount,
        porsiHariIni: todayPortionAgg._sum.portions || 0,
        successRate,
        deliveredToday,
        failedToday,
        pendingValidationCount,
        activeAnomalyCount
      }
    }
  };
};

const createSppg = async ({ payload, actorUserId, ipAddress }) => {
  const data = {
    name: payload.name.trim(),
    province: payload.province.trim(),
    city: payload.city.trim(),
    address: payload.address ?? null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    capacity: payload.capacity,
    workers: payload.workers ?? null,
    picName: payload.picName ?? null,
    picPhone: payload.picPhone ?? null,
    status: payload.status || "active"
  };

  const sppg = await prisma.$transaction(async (tx) => {
    const created = await tx.sppg.create({
      data
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "INSERT",
      tableName: "sppg",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: sppg
  };
};

const updateSppg = async ({ id, payload, actorUserId, ipAddress }) => {
  const existing = await getActiveSppgById(id);

  const updatedData = {
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.province !== undefined ? { province: payload.province.trim() } : {}),
    ...(payload.city !== undefined ? { city: payload.city.trim() } : {}),
    ...(payload.address !== undefined ? { address: payload.address } : {}),
    ...(payload.lat !== undefined ? { lat: payload.lat } : {}),
    ...(payload.lng !== undefined ? { lng: payload.lng } : {}),
    ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
    ...(payload.workers !== undefined ? { workers: payload.workers } : {}),
    ...(payload.picName !== undefined ? { picName: payload.picName } : {}),
    ...(payload.picPhone !== undefined ? { picPhone: payload.picPhone } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {})
  };

  const sppg = await prisma.$transaction(async (tx) => {
    const updated = await tx.sppg.update({
      where: {
        id: existing.id
      },
      data: updatedData
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "sppg",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: sppg
  };
};

const updateSppgStatus = async ({ id, status, actorUserId, ipAddress }) =>
  updateSppg({
    id,
    payload: {
      status
    },
    actorUserId,
    ipAddress
  });

const updateMySppgProfile = async ({ payload, user, ipAddress }) => {
  const sppgId = requireSppgScope(user);
  return updateSppg({
    id: sppgId,
    payload,
    actorUserId: user.userId,
    ipAddress
  });
};

const deleteSppg = async ({ id, actorUserId, ipAddress }) => {
  const existing = await getActiveSppgById(id);

  const deletedAt = new Date();

  const sppg = await prisma.$transaction(async (tx) => {
    const updated = await tx.sppg.update({
      where: {
        id: existing.id
      },
      data: {
        deletedAt
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "DELETE",
      tableName: "sppg",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: sppg
  };
};

const restoreSppg = async ({ id, actorUserId, ipAddress }) => {
  const existing = await getDeletedSppgById(id);

  const sppg = await prisma.$transaction(async (tx) => {
    const restored = await tx.sppg.update({
      where: {
        id: existing.id
      },
      data: {
        deletedAt: null
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "sppg",
      recordId: restored.id,
      oldData: existing,
      newData: {
        ...restored,
        auditAction: "RESTORE"
      },
      ipAddress
    });

    return restored;
  });

  return {
    data: sppg
  };
};

module.exports = {
  assignSchoolsToSppg,
  createSppg,
  deleteSppg,
  getSppgOperationalDetail,
  getSppgDetail,
  listAssignedSchoolsForSppg,
  listMyDapodikSchools,
  listMapMarkers,
  listMySchools,
  listDeletedSppg,
  listSppg,
  restoreSppg,
  unassignSchoolFromSppg,
  updateMySppgProfile,
  updateSppgStatus,
  updateSppg
};
