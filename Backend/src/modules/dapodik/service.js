const { env } = require("../../config/env");
const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const {
  buildLooseTokenSearchWhere,
  buildRankedSearchCandidateWhere,
  buildTokenSearchWhere,
  getRankedSearchCandidateLimit,
  hasSearchQuery,
  paginateRankedSearch,
  rankBySearch
} = require("../../utils/search");
const {
  MANUAL_IMPORT_ENDPOINT,
  importDapodikSchoolRows
} = require("./importer");

const prisma = getPrismaClient();

const normalizeOptionalText = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
};

const parseSchoolFilters = (query = {}) => ({
  semesterId: query.semester_id || env.DAPODIK_DEFAULT_SEMESTER_ID,
  kodeWilayah: query.kode_wilayah,
  province: query.province,
  city: query.city,
  district: query.district,
  educationLevel: query.education_level || query.bentuk_pendidikan_id,
  schoolStatus: query.school_status,
  npsn: query.npsn,
  search: query.search,
  autocomplete: query.autocomplete === true,
  linkStatus: query.link_status
});

const DAPODIK_SEARCH_FIELDS = ["name", "npsn", "city", "district", "province", "educationLevel", "schoolStatus"];
const DAPODIK_SEARCH_RANK_FIELDS = [
  { field: "name", weight: 7 },
  { field: "npsn", weight: 4 },
  { field: "city", weight: 3 },
  { field: "district", weight: 3 },
  { field: "province", weight: 2 },
  { field: "educationLevel", weight: 1.5 },
  { field: "schoolStatus", weight: 1 },
  { field: "dapodikSchoolId", weight: 0.15 },
  { field: "sourceHash", weight: 0.05 }
];

const buildLocalSchoolWhere = (query = {}) => {
  const filters = parseSchoolFilters(query);
  const andConditions = [];

  if (filters.educationLevel) {
    andConditions.push({
      OR: [
        {
          educationLevel: {
            equals: filters.educationLevel,
            mode: "insensitive"
          }
        },
        {
          bentukPendidikan: {
            equals: filters.educationLevel,
            mode: "insensitive"
          }
        },
        {
          bp: {
            equals: filters.educationLevel,
            mode: "insensitive"
          }
        }
      ]
    });
  }

  if (filters.search) {
    andConditions.push(buildTokenSearchWhere(filters.search, ["name", "npsn", "dapodikSchoolId", "city", "district", "province"]));
  }

  return {
    semesterId: filters.semesterId,
    ...(filters.kodeWilayah ? { kodeWilayah: filters.kodeWilayah } : {}),
    ...(filters.province ? { province: { contains: filters.province, mode: "insensitive" } } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
    ...(filters.district ? { district: { contains: filters.district, mode: "insensitive" } } : {}),
    ...(filters.linkStatus === "linked" ? { schoolLink: { isNot: null } } : {}),
    ...(filters.linkStatus === "unlinked" ? { schoolLink: { is: null } } : {}),
    ...(filters.schoolStatus
      ? {
          schoolStatus: {
            equals: filters.schoolStatus,
            mode: "insensitive"
          }
        }
      : {}),
    ...(filters.npsn ? { npsn: filters.npsn } : {}),
    ...(andConditions.length > 0 ? { AND: andConditions } : {})
  };
};

const buildLocalSchoolBaseWhere = (query = {}) =>
  buildLocalSchoolWhere({
    ...query,
    search: undefined
  });

const buildRegionWhere = (query = {}) => {
  const search = normalizeOptionalText(query.search);
  const level = Number(query.id_level_wilayah);

  if (level === 0) {
    return {
      ...buildTokenSearchWhere(search, ["name"]),
      ...(query.kode_wilayah && query.kode_wilayah !== "000000" ? { kodeWilayah: query.kode_wilayah } : {})
    };
  }

  if (level === 1) {
    return {
      ...buildTokenSearchWhere(search, ["name"]),
      ...(query.kode_wilayah && query.kode_wilayah !== "000000" ? { provinceKodeWilayah: query.kode_wilayah } : {})
    };
  }

  return {
    ...buildTokenSearchWhere(search, ["name"]),
    ...(query.kode_wilayah && query.kode_wilayah !== "000000" ? { cityKodeWilayah: query.kode_wilayah } : {})
  };
};

const buildRegionBaseWhere = (query = {}) =>
  buildRegionWhere({
    ...query,
    search: undefined
  });

const getRegionModel = (level) => {
  const normalizedLevel = Number(level);

  if (normalizedLevel === 0) {
    return prisma.dapodikProvince;
  }

  if (normalizedLevel === 1) {
    return prisma.dapodikCity;
  }

  if (normalizedLevel === 2) {
    return prisma.dapodikDistrict;
  }

  throw new AppError("Unsupported region level.", 400, "DAPODIK_REGION_LEVEL_INVALID");
};

const mapRegionRecord = (record) => ({
  id: record.id,
  name: record.name,
  kodeWilayah: record.kodeWilayah,
  idLevelWilayah: record.idLevelWilayah,
  semesterId: record.semesterId,
  url: record.url || null,
  summary: record.summary || null,
  parent: {
    provinceKodeWilayah: record.provinceKodeWilayah || null,
    provinceName: record.provinceName || null,
    cityKodeWilayah: record.cityKodeWilayah || null,
    cityName: record.cityName || null
  },
  raw: record.rawData || null
});

const mapStagedSchool = (item) => ({
  id: item.id,
  semesterId: item.semesterId,
  dapodikSchoolId: item.dapodikSchoolId,
  npsn: item.npsn,
  name: item.name,
  bp: item.bp,
  bentukPendidikan: item.bentukPendidikan,
  educationLevel: item.educationLevel,
  schoolStatus: item.schoolStatus,
  studentCount: item.studentCount,
  region: {
    province: item.province,
    provinceCode: item.provinceKodeWilayah,
    city: item.city,
    cityCode: item.cityKodeWilayah,
    district: item.district,
    districtCode: item.districtKodeWilayah || item.kodeWilayah
  },
  fetchedAt: item.fetchedAt,
  lastSyncAt: item.lastSyncAt,
  importBatchId: item.importBatchId,
  sourceHash: item.sourceHash,
  raw: item.rawData,
  linkedSchool: item.schoolLink
    ? {
        id: item.schoolLink.school.id,
        name: item.schoolLink.school.name,
        sppgId: item.schoolLink.school.sppgId
      }
    : null
});

const mapStagedSchoolAutocomplete = (item) => ({
  id: item.id,
  name: item.name,
  npsn: item.npsn,
  dapodikSchoolId: item.dapodikSchoolId,
  educationLevel: item.educationLevel || item.bentukPendidikan || item.bp,
  schoolStatus: item.schoolStatus,
  region: {
    province: item.province,
    city: item.city,
    district: item.district,
    districtCode: item.districtKodeWilayah || item.kodeWilayah
  },
  linkedSchool: item.schoolLink
    ? {
        id: item.schoolLink.school.id,
        name: item.schoolLink.school.name
      }
    : null
});

const buildSchoolIdentifierWhere = ({ dapodikSchoolId, npsn }) => {
  const identifiers = [];

  if (dapodikSchoolId) {
    identifiers.push({ dapodikSchoolId });
  }

  if (npsn) {
    identifiers.push({ npsn });
  }

  return identifiers;
};

const getActiveSppg = async (id) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const getActiveSchoolById = async (id) => {
  const school = await prisma.school.findFirst({
    where: {
      id: Number(id),
      deletedAt: null,
      sppg: {
        deletedAt: null
      }
    },
    include: {
      sppg: true,
      dapodikLink: {
        include: {
          dapodikSchool: true
        }
      }
    }
  });

  if (!school) {
    throw new AppError("School not found.", 404, "SCHOOL_NOT_FOUND");
  }

  return school;
};

const getStagedSchoolById = async (id) => {
  const stagedSchool = await prisma.dapodikSchool.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      schoolLink: {
        include: {
          school: {
            include: {
              sppg: true
            }
          }
        }
      },
      districtRef: {
        include: {
          city: true,
          province: true
        }
      }
    }
  });

  if (!stagedSchool) {
    throw new AppError("Dapodik school not found.", 404, "DAPODIK_SCHOOL_NOT_FOUND");
  }

  return stagedSchool;
};

const createSyncLog = async ({ endpoint, status, params, resultMeta = null, error = null, startedAt }) =>
  prisma.dapodikSyncLog.create({
    data: {
      endpoint,
      status,
      semesterId: params.semester_id || null,
      kodeWilayah: params.kode_wilayah || null,
      idLevelWilayah: params.id_level_wilayah ?? null,
      educationLevel: params.bentuk_pendidikan_id || params.education_level || null,
      requestParams: params,
      resultMeta,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      startedAt,
      finishedAt: new Date()
    }
  });

const parseCsvRows = (content) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(value);

      if (row.some((cell) => String(cell || "").trim())) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);

  if (row.some((cell) => String(cell || "").trim())) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => String(header || "").trim());

  return rows.slice(1).map((cells) =>
    headers.reduce((accumulator, header, index) => {
      if (header) {
        accumulator[header] = String(cells[index] || "").trim();
      }

      return accumulator;
    }, {})
  );
};

const parseImportItems = ({ payload, file }) => {
  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (typeof payload.csv === "string" && payload.csv.trim()) {
    return parseCsvRows(payload.csv);
  }

  if (!file) {
    throw new AppError("Import file or items payload is required.", 400, "DAPODIK_IMPORT_FILE_REQUIRED");
  }

  const content = file.buffer.toString("utf8");
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".json") || file.mimetype === "application/json") {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.items || parsed.data;

    if (!Array.isArray(items)) {
      throw new AppError("JSON import must be an array or contain items/data array.", 400, "DAPODIK_IMPORT_JSON_INVALID");
    }

    return items;
  }

  if (fileName.endsWith(".csv") || file.mimetype === "text/csv") {
    return parseCsvRows(content);
  }

  throw new AppError("Only JSON or CSV import files are supported.", 400, "DAPODIK_IMPORT_FILE_UNSUPPORTED");
};

const getRegionRecap = async ({ query }) => {
  const pagination = parsePagination(query);
  const model = getRegionModel(query.id_level_wilayah);
  const where = buildRegionWhere(query);

  if (hasSearchQuery(query.search)) {
    const baseWhere = buildRegionBaseWhere(query);
    const candidateLimit = getRankedSearchCandidateLimit(pagination);
    let candidates = await model.findMany({
      where: buildRankedSearchCandidateWhere(baseWhere, query.search, ["name"]),
      take: candidateLimit,
      orderBy: [{ name: "asc" }]
    });

    const ranked = paginateRankedSearch({
      items: candidates,
      query: query.search,
      fieldConfigs: [{ field: "name", weight: 7 }],
      pagination
    });

    return {
      data: ranked.items.map(mapRegionRecord),
      meta: {
        ...buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: ranked.total
        }),
        source: "dapodik_local_db",
        level: query.id_level_wilayah,
        parentKodeWilayah: query.kode_wilayah || null,
        searchMode: "partial_fuzzy_ranked"
      }
    };
  }

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ name: "asc" }]
    }),
    model.count({ where })
  ]);

  return {
    data: items.map(mapRegionRecord),
    meta: {
      ...buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        total
      }),
      source: "dapodik_local_db",
      level: query.id_level_wilayah,
      parentKodeWilayah: query.kode_wilayah || null
    }
  };
};

const getSchoolProgress = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = buildLocalSchoolWhere(query);
  const filters = parseSchoolFilters(query);
  const take = filters.autocomplete ? Math.min(pagination.limit, 20) : pagination.limit;

  if (filters.search) {
    const baseWhere = buildLocalSchoolBaseWhere(query);
    const candidateWhere = {
      ...baseWhere,
      AND: [
        ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : []),
        buildLooseTokenSearchWhere(filters.search, DAPODIK_SEARCH_FIELDS)
      ].filter((condition) => Object.keys(condition).length > 0)
    };
    const candidateLimit = Math.max(500, Math.min(5000, pagination.page * take * 30));
    let candidates = await prisma.dapodikSchool.findMany({
      where: candidateWhere,
      take: candidateLimit,
      orderBy: [{ province: "asc" }, { city: "asc" }, { district: "asc" }, { name: "asc" }],
      include: {
        schoolLink: {
          include: {
            school: true
          }
        }
      }
    });

    const rankedItems = rankBySearch(candidates, filters.search, DAPODIK_SEARCH_RANK_FIELDS);
    const pageItems = rankedItems.slice(pagination.skip, pagination.skip + take);

    return {
      data: filters.autocomplete ? pageItems.map(mapStagedSchoolAutocomplete) : pageItems.map(mapStagedSchool),
      meta: {
        ...buildPaginationMeta({
          page: pagination.page,
          limit: take,
          total: rankedItems.length
        }),
        source: "dapodik_local_db",
        autocomplete: filters.autocomplete,
        searchMode: "partial_fuzzy_ranked"
      }
    };
  }

  const [items, total] = await Promise.all([
    prisma.dapodikSchool.findMany({
      where,
      skip: pagination.skip,
      take,
      orderBy: [{ province: "asc" }, { city: "asc" }, { district: "asc" }, { name: "asc" }],
      include: {
        schoolLink: {
          include: {
            school: true
          }
        }
      }
    }),
    prisma.dapodikSchool.count({ where })
  ]);

  return {
    data: filters.autocomplete ? items.map(mapStagedSchoolAutocomplete) : items.map(mapStagedSchool),
    meta: {
      ...buildPaginationMeta({
        page: pagination.page,
        limit: take,
        total
      }),
      source: "dapodik_local_db",
      autocomplete: filters.autocomplete
    }
  };
};

const syncSchoolProgress = async ({ payload }) => {
  const startedAt = new Date();
  const params = {
    id_level_wilayah: payload.id_level_wilayah,
    kode_wilayah: payload.kode_wilayah,
    semester_id: payload.semester_id,
    bentuk_pendidikan_id: payload.bentuk_pendidikan_id
  };
  const error = new AppError(
    "Upstream Dapodik sync is disabled. Import local JSON via npm run import:dapodik instead.",
    410,
    "DAPODIK_UPSTREAM_DISABLED"
  );

  await createSyncLog({
    endpoint: "disabled_upstream_sync",
    status: "disabled",
    params,
    resultMeta: {
      source: "dapodik_local_db_only",
      message: error.message
    },
    error,
    startedAt
  });

  throw error;
};

const listStagedSchools = async ({ query }) => getSchoolProgress({ query });

const getStagedSchoolDetail = async ({ id }) => {
  const stagedSchool = await getStagedSchoolById(id);

  return {
    data: mapStagedSchool(stagedSchool)
  };
};

const findExistingSchoolForPromotion = async ({ tx, dapodikSchoolId, npsn }) => {
  const identifiers = buildSchoolIdentifierWhere({
    dapodikSchoolId,
    npsn
  });

  if (identifiers.length === 0) {
    return null;
  }

  const matches = await tx.school.findMany({
    where: {
      OR: identifiers
    },
    include: {
      sppg: true
    }
  });
  const uniqueIds = new Set(matches.map((item) => item.id));

  if (uniqueIds.size > 1) {
    throw new AppError(
      "Multiple local schools match this Dapodik school. Please resolve duplicate NPSN/Dapodik IDs first.",
      409,
      "SCHOOL_DUPLICATE_CONFLICT"
    );
  }

  return matches[0] || null;
};

const ensureSchoolLink = async ({ tx, schoolId, stagedSchoolId, linkedBy }) => {
  const existingLink = await tx.schoolDapodikLink.findFirst({
    where: {
      OR: [
        { schoolId },
        { dapodikSchoolRecordId: stagedSchoolId }
      ]
    }
  });

  if (
    existingLink &&
    (existingLink.schoolId !== schoolId || existingLink.dapodikSchoolRecordId !== stagedSchoolId)
  ) {
    throw new AppError(
      "Dapodik school link conflicts with another local school link.",
      409,
      "DAPODIK_SCHOOL_LINK_CONFLICT"
    );
  }

  if (existingLink) {
    return tx.schoolDapodikLink.update({
      where: {
        id: existingLink.id
      },
      data: {
        linkedBy
      }
    });
  }

  return tx.schoolDapodikLink.create({
    data: {
      schoolId,
      dapodikSchoolRecordId: stagedSchoolId,
      linkedBy
    }
  });
};

const ensureSchoolIdentifierAvailability = async ({ tx, schoolId, dapodikSchoolId, npsn }) => {
  const identifiers = buildSchoolIdentifierWhere({
    dapodikSchoolId,
    npsn
  });

  if (identifiers.length === 0) {
    return;
  }

  const conflictingSchool = await tx.school.findFirst({
    where: {
      id: {
        not: schoolId
      },
      deletedAt: null,
      OR: identifiers
    },
    select: {
      id: true,
      name: true
    }
  });

  if (conflictingSchool) {
    throw new AppError(
      `Dapodik identifier already belongs to another school (${conflictingSchool.name}).`,
      409,
      "DAPODIK_IDENTIFIER_CONFLICT"
    );
  }
};

const buildLinkedSchoolUpdateData = ({ existingSchool, stagedSchool, payload }) => {
  const updateData = {};

  if (payload.syncFields !== false) {
    updateData.name = stagedSchool.name.trim();
    updateData.province = stagedSchool.province?.trim() || existingSchool.province;
    updateData.city = stagedSchool.city?.trim() || existingSchool.city;
    updateData.district = stagedSchool.district ?? existingSchool.district;
    updateData.npsn = stagedSchool.npsn;
    updateData.dapodikSchoolId = stagedSchool.dapodikSchoolId;
    updateData.educationLevel = stagedSchool.educationLevel;
    updateData.schoolStatus = stagedSchool.schoolStatus;
    updateData.dapodikSyncedAt = stagedSchool.lastSyncAt;
    updateData.totalStudents = payload.totalStudents ?? stagedSchool.studentCount ?? existingSchool.totalStudents;
  }

  if (payload.totalStudents !== undefined) {
    updateData.totalStudents = payload.totalStudents;
  }

  if (payload.address !== undefined) {
    updateData.address = normalizeOptionalText(payload.address);
  }

  return updateData;
};

const promoteStagedSchool = async ({ id, payload, actorUserId, ipAddress }) => {
  await getActiveSppg(payload.sppgId);

  const stagedSchool = await getStagedSchoolById(id);

  if (!stagedSchool.province || !stagedSchool.city) {
    throw new AppError(
      "Dapodik school is missing province or city and cannot be promoted safely.",
      400,
      "DAPODIK_SCHOOL_REGION_INCOMPLETE"
    );
  }

  const baseSchoolData = {
    name: stagedSchool.name.trim(),
    province: stagedSchool.province.trim(),
    city: stagedSchool.city.trim(),
    district: stagedSchool.district,
    sppgId: payload.sppgId,
    totalStudents: payload.totalStudents ?? stagedSchool.studentCount ?? 0,
    npsn: stagedSchool.npsn,
    dapodikSchoolId: stagedSchool.dapodikSchoolId,
    educationLevel: stagedSchool.educationLevel,
    schoolStatus: stagedSchool.schoolStatus,
    dapodikSyncedAt: stagedSchool.lastSyncAt
  };

  const promoted = await prisma.$transaction(async (tx) => {
    const existing = await findExistingSchoolForPromotion({
      tx,
      dapodikSchoolId: stagedSchool.dapodikSchoolId,
      npsn: stagedSchool.npsn
    });

    if (existing) {
      const updated = await tx.school.update({
        where: {
          id: existing.id
        },
        data: {
          ...baseSchoolData,
          address:
            payload.address !== undefined ? normalizeOptionalText(payload.address) : existing.address,
          deletedAt: null
        },
        include: {
          sppg: true
        }
      });

      const link = await ensureSchoolLink({
        tx,
        schoolId: updated.id,
        stagedSchoolId: stagedSchool.id,
        linkedBy: actorUserId
      });

      await createAuditLog({
        prisma: tx,
        userId: actorUserId,
        action: "UPDATE",
        tableName: "schools",
        recordId: updated.id,
        oldData: existing,
        newData: {
          ...updated,
          dapodikLinkId: link.id,
          promotedFromDapodikSchoolId: stagedSchool.id
        },
        ipAddress
      });

      return {
        action: "updated",
        school: updated,
        link
      };
    }

    const created = await tx.school.create({
      data: {
        ...baseSchoolData,
        address: normalizeOptionalText(payload.address) ?? null
      },
      include: {
        sppg: true
      }
    });
    const link = await ensureSchoolLink({
      tx,
      schoolId: created.id,
      stagedSchoolId: stagedSchool.id,
      linkedBy: actorUserId
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "INSERT",
      tableName: "schools",
      recordId: created.id,
      newData: {
        ...created,
        dapodikLinkId: link.id,
        promotedFromDapodikSchoolId: stagedSchool.id
      },
      ipAddress
    });

    return {
      action: "created",
      school: created,
      link
    };
  });

  return {
    data: promoted.school,
    meta: {
      action: promoted.action,
      dapodikSchoolId: stagedSchool.id,
      linkId: promoted.link.id
    }
  };
};

const linkStagedSchool = async ({ id, payload, actorUserId, ipAddress }) => {
  const stagedSchool = await getStagedSchoolById(id);
  const existingSchool = await getActiveSchoolById(payload.schoolId);

  if (!stagedSchool.province || !stagedSchool.city) {
    throw new AppError(
      "Dapodik school is missing province or city and cannot be linked safely.",
      400,
      "DAPODIK_SCHOOL_REGION_INCOMPLETE"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureSchoolIdentifierAvailability({
      tx,
      schoolId: existingSchool.id,
      dapodikSchoolId: stagedSchool.dapodikSchoolId,
      npsn: stagedSchool.npsn
    });

    const link = await ensureSchoolLink({
      tx,
      schoolId: existingSchool.id,
      stagedSchoolId: stagedSchool.id,
      linkedBy: actorUserId
    });
    const updateData = buildLinkedSchoolUpdateData({
      existingSchool,
      stagedSchool,
      payload
    });
    let updatedSchool = existingSchool;

    if (Object.keys(updateData).length > 0) {
      updatedSchool = await tx.school.update({
        where: {
          id: existingSchool.id
        },
        data: updateData,
        include: {
          sppg: true,
          dapodikLink: {
            include: {
              dapodikSchool: true
            }
          }
        }
      });

      await createAuditLog({
        prisma: tx,
        userId: actorUserId,
        action: "UPDATE",
        tableName: "schools",
        recordId: updatedSchool.id,
        oldData: existingSchool,
        newData: {
          ...updatedSchool,
          dapodikLinkId: link.id,
          linkedFromDapodikSchoolId: stagedSchool.id
        },
        ipAddress
      });
    }

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: existingSchool.dapodikLink ? "UPDATE" : "INSERT",
      tableName: "school_dapodik_links",
      recordId: link.id,
      oldData: existingSchool.dapodikLink || null,
      newData: {
        id: link.id,
        schoolId: link.schoolId,
        dapodikSchoolRecordId: link.dapodikSchoolRecordId,
        linkedBy: link.linkedBy
      },
      ipAddress
    });

    return {
      school: updatedSchool,
      link
    };
  });

  return {
    data: result.school,
    meta: {
      linked: true,
      linkId: result.link.id,
      dapodikSchoolId: stagedSchool.id,
      schoolId: existingSchool.id
    }
  };
};

const importStagedSchools = async ({ payload, file }) => {
  const startedAt = new Date();
  const params = {
    id_level_wilayah: payload.id_level_wilayah ?? 3,
    kode_wilayah: payload.kode_wilayah || null,
    semester_id: payload.semester_id || env.DAPODIK_DEFAULT_SEMESTER_ID,
    bentuk_pendidikan_id: payload.bentuk_pendidikan_id || null
  };

  let rawItems;

  try {
    rawItems = parseImportItems({
      payload,
      file
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppError("JSON import file is invalid.", 400, "DAPODIK_IMPORT_JSON_INVALID");
    }

    throw error;
  }

  const summary = await importDapodikSchoolRows({
    items: rawItems,
    semesterId: params.semester_id,
    fetchedAt: new Date(),
    sourceLabel: file ? `${MANUAL_IMPORT_ENDPOINT}:${file.originalname}` : MANUAL_IMPORT_ENDPOINT
  });

  await createSyncLog({
    endpoint: MANUAL_IMPORT_ENDPOINT,
    status: "imported",
    params,
    resultMeta: {
      ...summary,
      importedFile: file
        ? {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          }
        : null
    },
    startedAt
  });

  return {
    data: summary,
    meta: {
      source: "dapodik_local_import"
    }
  };
};

const getLatestSyncLog = async ({ query }) => {
  const log = await prisma.dapodikSyncLog.findFirst({
    where: {
      ...(query.endpoint ? { endpoint: query.endpoint } : {}),
      ...(query.kode_wilayah ? { kodeWilayah: query.kode_wilayah } : {}),
      ...(query.semester_id ? { semesterId: query.semester_id } : {}),
      ...(query.status ? { status: query.status } : {})
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return {
    data: log
  };
};

module.exports = {
  getRegionRecap,
  getSchoolProgress,
  getStagedSchoolDetail,
  getLatestSyncLog,
  importStagedSchools,
  linkStagedSchool,
  listStagedSchools,
  promoteStagedSchool,
  syncSchoolProgress
};
