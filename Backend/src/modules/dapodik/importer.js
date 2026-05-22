const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { z } = require("zod");

const { env } = require("../../config/env");
const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");

const prisma = getPrismaClient();

const LOCAL_DATASET_FILES = {
  provinces: "provinces.json",
  cities: "cities.json",
  districts: "districts.json",
  schools: "schools-lite.json",
  progress: "progress.json",
  errors: "errors.json"
};

const DEFAULT_BATCH_SIZE = 500;
const LOCAL_IMPORT_ENDPOINT = "local_directory_import";
const MANUAL_IMPORT_ENDPOINT = "manual_school_import";

const provinceRowSchema = z
  .object({
    name: z.string().optional(),
    kode_wilayah: z.string().optional(),
    id_level_wilayah: z.union([z.number(), z.string()]).optional(),
    url: z.string().optional(),
    summary: z.unknown().optional(),
    raw: z.unknown().optional()
  })
  .passthrough();

const cityRowSchema = z
  .object({
    name: z.string().optional(),
    kode_wilayah: z.string().optional(),
    province_name: z.string().optional(),
    province_kode_wilayah: z.string().optional(),
    id_level_wilayah: z.union([z.number(), z.string()]).optional(),
    url: z.string().optional(),
    summary: z.unknown().optional(),
    raw: z.unknown().optional()
  })
  .passthrough();

const districtRowSchema = z
  .object({
    name: z.string().optional(),
    kode_wilayah: z.string().optional(),
    province_name: z.string().optional(),
    province_kode_wilayah: z.string().optional(),
    city_name: z.string().optional(),
    city_kode_wilayah: z.string().optional(),
    id_level_wilayah: z.union([z.number(), z.string()]).optional(),
    url: z.string().optional(),
    summary: z.unknown().optional(),
    raw: z.unknown().optional()
  })
  .passthrough();

const schoolRowSchema = z
  .object({
    sekolah_id: z.string().optional(),
    id: z.string().optional(),
    dapodik_school_id: z.string().optional(),
    dapodikSchoolId: z.string().optional(),
    nama_sekolah: z.string().optional(),
    name: z.string().optional(),
    npsn: z.string().optional(),
    bp: z.string().optional(),
    bentuk_pendidikan: z.string().optional(),
    jenjang: z.string().optional(),
    education_level: z.string().optional(),
    educationLevel: z.string().optional(),
    status_sekolah: z.string().optional(),
    school_status: z.string().optional(),
    schoolStatus: z.string().optional(),
    kode_wilayah: z.string().optional(),
    district_kode_wilayah: z.string().optional(),
    city_kode_wilayah: z.string().optional(),
    province_kode_wilayah: z.string().optional(),
    nama_kecamatan: z.string().optional(),
    nama_kab_kota: z.string().optional(),
    nama_provinsi: z.string().optional()
  })
  .passthrough();

const collapseWhitespace = (value) => String(value).replace(/\s+/g, " ").trim();

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const collapsed = collapseWhitespace(value);
  return collapsed || null;
};

const normalizeCode = (value) => {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return /^\d{6}$/.test(text) ? text : null;
};

const pickFirst = (...values) => values.find((value) => normalizeText(value) !== null);

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseOptionalDate = (value) => {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const ensureArray = (value, fileName) => {
  if (!Array.isArray(value)) {
    throw new Error(`${fileName} harus berupa array JSON.`);
  }

  return value;
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const chunkArray = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const buildTimestampId = (date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const buildImportBatchId = ({ semesterId, sourceHash, startedAt }) =>
  `${semesterId}-${buildTimestampId(startedAt)}-${sourceHash.slice(0, 10)}`;

const buildRegionLookups = ({ provinces, cities, districts }) => {
  const provincesByCode = new Map(provinces.map((item) => [item.kodeWilayah, item]));
  const citiesByCode = new Map(cities.map((item) => [item.kodeWilayah, item]));
  const districtsByCode = new Map(districts.map((item) => [item.kodeWilayah, item]));

  return {
    provincesByCode,
    citiesByCode,
    districtsByCode
  };
};

const regionSummaryMeta = ({ progress, errors, provinces, schools }) => {
  const schoolProvinceNames = new Set(
    schools.map((item) => item.province).filter((value) => typeof value === "string" && value.trim())
  );
  const progressPhase = normalizeText(progress?.current?.phase);

  return {
    isPartial:
      progressPhase !== null && progressPhase !== "completed"
        ? true
        : schoolProvinceNames.size > 0 && schoolProvinceNames.size < provinces.length,
    progressPhase,
    progressUpdatedAt: normalizeText(progress?.updated_at),
    errorCount: Array.isArray(errors) ? errors.length : 0,
    provincesInSchoolData: schoolProvinceNames.size,
    totalProvinceRows: provinces.length
  };
};

const readJsonFile = async (absolutePath) => {
  const content = await fs.readFile(absolutePath, "utf8");
  return {
    content,
    parsed: JSON.parse(content)
  };
};

const loadLocalDapodikDataset = async ({ directoryPath }) => {
  const absoluteDirectory = path.resolve(directoryPath);
  const entries = {};

  for (const [key, fileName] of Object.entries(LOCAL_DATASET_FILES)) {
    const absolutePath = path.join(absoluteDirectory, fileName);
    const optional = key === "progress" || key === "errors";

    try {
      entries[key] = {
        absolutePath,
        ...(await readJsonFile(absolutePath))
      };
    } catch (error) {
      if (optional && error.code === "ENOENT") {
        entries[key] = null;
        continue;
      }

      if (error instanceof SyntaxError) {
        throw new Error(`${fileName} bukan JSON yang valid.`);
      }

      if (error.code === "ENOENT") {
        throw new Error(`File ${fileName} tidak ditemukan di ${absoluteDirectory}.`);
      }

      throw error;
    }
  }

  const provinces = ensureArray(entries.provinces.parsed, LOCAL_DATASET_FILES.provinces);
  const cities = ensureArray(entries.cities.parsed, LOCAL_DATASET_FILES.cities);
  const districts = ensureArray(entries.districts.parsed, LOCAL_DATASET_FILES.districts);
  const schools = ensureArray(entries.schools.parsed, LOCAL_DATASET_FILES.schools);
  const progress = entries.progress?.parsed ?? null;
  const errors = entries.errors?.parsed ?? [];
  const sourceHash = sha256(
    [entries.provinces.content, entries.cities.content, entries.districts.content, entries.schools.content].join("\n")
  );

  return {
    absoluteDirectory,
    files: entries,
    sourceHash,
    provinces,
    cities,
    districts,
    schools,
    progress,
    errors
  };
};

const buildRegionPayloadBase = ({ semesterId, importBatchId, sourceHash, touchedAt }) => ({
  semesterId,
  importBatchId,
  sourceHash,
  createdAt: touchedAt,
  updatedAt: touchedAt
});

const normalizeProvinceRow = ({ row, semesterId, importBatchId, sourceHash, touchedAt, index }) => {
  const parsed = provinceRowSchema.safeParse(row);

  if (!parsed.success) {
    return {
      ok: false,
      reason: `Baris province ${index + 1} tidak sesuai struktur yang diharapkan.`
    };
  }

  const name = normalizeText(parsed.data.name);
  const kodeWilayah = normalizeCode(parsed.data.kode_wilayah);
  const idLevelWilayah = toIntegerOrNull(parsed.data.id_level_wilayah);

  if (!name || !kodeWilayah || idLevelWilayah === null) {
    return {
      ok: false,
      reason: `Baris province ${index + 1} kehilangan name/kode_wilayah/id_level_wilayah yang valid.`
    };
  }

  return {
    ok: true,
    value: {
      ...buildRegionPayloadBase({ semesterId, importBatchId, sourceHash, touchedAt }),
      kodeWilayah,
      name,
      idLevelWilayah,
      url: normalizeText(parsed.data.url),
      summary: isPlainObject(parsed.data.summary) ? parsed.data.summary : null,
      rawData: isPlainObject(parsed.data.raw) ? parsed.data.raw : null
    }
  };
};

const normalizeCityRow = ({ row, semesterId, importBatchId, sourceHash, touchedAt, index }) => {
  const parsed = cityRowSchema.safeParse(row);

  if (!parsed.success) {
    return {
      ok: false,
      reason: `Baris city ${index + 1} tidak sesuai struktur yang diharapkan.`
    };
  }

  const name = normalizeText(parsed.data.name);
  const kodeWilayah = normalizeCode(parsed.data.kode_wilayah);
  const provinceKodeWilayah = normalizeCode(parsed.data.province_kode_wilayah);
  const provinceName = normalizeText(parsed.data.province_name);
  const idLevelWilayah = toIntegerOrNull(parsed.data.id_level_wilayah);

  if (!name || !kodeWilayah || idLevelWilayah === null) {
    return {
      ok: false,
      reason: `Baris city ${index + 1} kehilangan name/kode_wilayah/id_level_wilayah yang valid.`
    };
  }

  return {
    ok: true,
    value: {
      ...buildRegionPayloadBase({ semesterId, importBatchId, sourceHash, touchedAt }),
      kodeWilayah,
      provinceKodeWilayah,
      name,
      provinceName,
      idLevelWilayah,
      url: normalizeText(parsed.data.url),
      summary: isPlainObject(parsed.data.summary) ? parsed.data.summary : null,
      rawData: isPlainObject(parsed.data.raw) ? parsed.data.raw : null
    }
  };
};

const normalizeDistrictRow = ({ row, semesterId, importBatchId, sourceHash, touchedAt, index }) => {
  const parsed = districtRowSchema.safeParse(row);

  if (!parsed.success) {
    return {
      ok: false,
      reason: `Baris district ${index + 1} tidak sesuai struktur yang diharapkan.`
    };
  }

  const name = normalizeText(parsed.data.name);
  const kodeWilayah = normalizeCode(parsed.data.kode_wilayah);
  const provinceKodeWilayah = normalizeCode(parsed.data.province_kode_wilayah);
  const cityKodeWilayah = normalizeCode(parsed.data.city_kode_wilayah);
  const provinceName = normalizeText(parsed.data.province_name);
  const cityName = normalizeText(parsed.data.city_name);
  const idLevelWilayah = toIntegerOrNull(parsed.data.id_level_wilayah);

  if (!name || !kodeWilayah || idLevelWilayah === null) {
    return {
      ok: false,
      reason: `Baris district ${index + 1} kehilangan name/kode_wilayah/id_level_wilayah yang valid.`
    };
  }

  return {
    ok: true,
    value: {
      ...buildRegionPayloadBase({ semesterId, importBatchId, sourceHash, touchedAt }),
      kodeWilayah,
      provinceKodeWilayah,
      cityKodeWilayah,
      name,
      provinceName,
      cityName,
      idLevelWilayah,
      url: normalizeText(parsed.data.url),
      summary: isPlainObject(parsed.data.summary) ? parsed.data.summary : null,
      rawData: isPlainObject(parsed.data.raw) ? parsed.data.raw : null
    }
  };
};

const normalizeSchoolRow = ({
  row,
  semesterId,
  importBatchId,
  sourceHash,
  fetchedAt,
  index,
  lookups = {}
}) => {
  const parsed = schoolRowSchema.safeParse(row);

  if (!parsed.success) {
    return {
      ok: false,
      reason: `Baris school ${index + 1} tidak sesuai struktur yang diharapkan.`
    };
  }

  const districtCode = normalizeCode(
    pickFirst(parsed.data.kode_wilayah, parsed.data.district_kode_wilayah, row.region?.districtCode)
  );
  const district = districtCode ? lookups.districtsByCode?.get(districtCode) : null;
  const cityCode = normalizeCode(
    pickFirst(parsed.data.city_kode_wilayah, row.region?.cityCode, district?.cityKodeWilayah)
  );
  const city = cityCode ? lookups.citiesByCode?.get(cityCode) : null;
  const provinceCode = normalizeCode(
    pickFirst(parsed.data.province_kode_wilayah, row.region?.provinceCode, district?.provinceKodeWilayah, city?.provinceKodeWilayah)
  );
  const province = provinceCode ? lookups.provincesByCode?.get(provinceCode) : null;
  const dapodikSchoolId = normalizeText(
    pickFirst(parsed.data.sekolah_id, parsed.data.dapodik_school_id, parsed.data.dapodikSchoolId, parsed.data.id)
  );
  const npsn = normalizeText(parsed.data.npsn);
  const name = normalizeText(pickFirst(parsed.data.nama_sekolah, parsed.data.name));

  if (!name || (!dapodikSchoolId && !npsn)) {
    return {
      ok: false,
      reason: `Baris school ${index + 1} kehilangan nama sekolah atau identifier (sekolah_id / npsn).`
    };
  }

  const provinceName = normalizeText(pickFirst(parsed.data.nama_provinsi, row.region?.province, province?.name));
  const cityName = normalizeText(pickFirst(parsed.data.nama_kab_kota, row.region?.city, city?.name));
  const districtName = normalizeText(pickFirst(parsed.data.nama_kecamatan, row.region?.district, district?.name));
  const lastSyncAt = parseOptionalDate(pickFirst(row.lastSyncAt, row.last_sync_at, row.sinkron_terakhir));

  return {
    ok: true,
    value: {
      semesterId,
      dapodikSchoolId,
      npsn,
      name,
      bp: normalizeText(parsed.data.bp),
      bentukPendidikan: normalizeText(pickFirst(parsed.data.bentuk_pendidikan, parsed.data.education_level, parsed.data.educationLevel)),
      province: provinceName,
      city: cityName,
      district: districtName,
      provinceKodeWilayah: provinceCode,
      cityKodeWilayah: cityCode,
      districtKodeWilayah: districtCode,
      educationLevel: normalizeText(
        pickFirst(parsed.data.jenjang, parsed.data.education_level, parsed.data.educationLevel, parsed.data.bentuk_pendidikan, parsed.data.bp)
      ),
      schoolStatus: normalizeText(pickFirst(parsed.data.status_sekolah, parsed.data.school_status, parsed.data.schoolStatus)),
      studentCount: toIntegerOrNull(pickFirst(row.student_count, row.total_students, row.totalStudents, row.pd)),
      kodeWilayah: districtCode,
      idLevelWilayah: toIntegerOrNull(pickFirst(row.id_level_wilayah, 3)),
      rawData: isPlainObject(row.raw) ? row.raw : row,
      fetchedAt,
      lastSyncAt,
      importBatchId,
      sourceHash,
      createdAt: fetchedAt,
      updatedAt: fetchedAt
    }
  };
};

const regionHasChanges = (existing, nextValue, extras = []) =>
  existing.semesterId !== nextValue.semesterId ||
  existing.name !== nextValue.name ||
  existing.idLevelWilayah !== nextValue.idLevelWilayah ||
  (existing.url || null) !== (nextValue.url || null) ||
  JSON.stringify(existing.summary || null) !== JSON.stringify(nextValue.summary || null) ||
  JSON.stringify(existing.rawData || null) !== JSON.stringify(nextValue.rawData || null) ||
  existing.sourceHash !== nextValue.sourceHash ||
  extras.some(({ key }) => (existing[key] || null) !== (nextValue[key] || null));

const schoolHasChanges = (existing, nextValue) =>
  (existing.dapodikSchoolId || null) !== (nextValue.dapodikSchoolId || null) ||
  (existing.npsn || null) !== (nextValue.npsn || null) ||
  existing.name !== nextValue.name ||
  (existing.bp || null) !== (nextValue.bp || null) ||
  (existing.bentukPendidikan || null) !== (nextValue.bentukPendidikan || null) ||
  (existing.province || null) !== (nextValue.province || null) ||
  (existing.city || null) !== (nextValue.city || null) ||
  (existing.district || null) !== (nextValue.district || null) ||
  (existing.provinceKodeWilayah || null) !== (nextValue.provinceKodeWilayah || null) ||
  (existing.cityKodeWilayah || null) !== (nextValue.cityKodeWilayah || null) ||
  (existing.districtKodeWilayah || null) !== (nextValue.districtKodeWilayah || null) ||
  (existing.educationLevel || null) !== (nextValue.educationLevel || null) ||
  (existing.schoolStatus || null) !== (nextValue.schoolStatus || null) ||
  (existing.studentCount ?? null) !== (nextValue.studentCount ?? null) ||
  (existing.kodeWilayah || null) !== (nextValue.kodeWilayah || null) ||
  (existing.idLevelWilayah ?? null) !== (nextValue.idLevelWilayah ?? null) ||
  existing.sourceHash !== nextValue.sourceHash ||
  JSON.stringify(existing.rawData || null) !== JSON.stringify(nextValue.rawData || null) ||
  existing.fetchedAt.getTime() !== nextValue.fetchedAt.getTime() ||
  (existing.lastSyncAt?.getTime() ?? null) !== (nextValue.lastSyncAt?.getTime() ?? null);

const createSyncLog = async ({ endpoint, status, params, resultMeta, error = null, startedAt }) =>
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

const applyCreateMany = async ({ model, rows, batchSize }) => {
  let count = 0;

  for (const chunk of chunkArray(rows, batchSize)) {
    if (chunk.length === 0) {
      continue;
    }

    const result = await model.createMany({
      data: chunk
    });

    count += result.count;
  }

  return count;
};

const upsertRegions = async ({
  model,
  existingRows,
  normalizedRows,
  batchSize,
  extraKeys = []
}) => {
  const existingMap = new Map(existingRows.map((item) => [item.kodeWilayah, item]));
  const seenCodes = new Set();
  const toCreate = [];
  const toUpdate = [];
  const skipped = [];
  let unchangedCount = 0;

  normalizedRows.forEach((item, index) => {
    if (!item.ok) {
      skipped.push(item.reason);
      return;
    }

    if (seenCodes.has(item.value.kodeWilayah)) {
      skipped.push(`Baris region ${index + 1} duplikat pada kode_wilayah ${item.value.kodeWilayah}.`);
      return;
    }

    seenCodes.add(item.value.kodeWilayah);

    const existing = existingMap.get(item.value.kodeWilayah);

    if (!existing) {
      toCreate.push(item.value);
      return;
    }

    if (
      regionHasChanges(
        existing,
        item.value,
        extraKeys.map((key) => ({ key }))
      )
    ) {
      toUpdate.push({
        id: existing.id,
        data: item.value
      });
      return;
    }

    unchangedCount += 1;
  });

  return {
    toCreate,
    toUpdate,
    unchangedCount,
    skipped
  };
};

const applyRegionMutations = async ({ model, plan, batchSize }) => {
  const createdCount = await applyCreateMany({
    model,
    rows: plan.toCreate,
    batchSize
  });

  let updatedCount = 0;

  for (const item of plan.toUpdate) {
    await model.update({
      where: {
        id: item.id
      },
      data: item.data
    });
    updatedCount += 1;
  }

  return {
    createdCount,
    updatedCount,
    unchangedCount: plan.unchangedCount,
    skippedCount: plan.skipped.length,
    skipped: plan.skipped
  };
};

const buildExistingSchoolMaps = (rows) => {
  const byDapodikId = new Map();
  const byNpsn = new Map();

  rows.forEach((item) => {
    if (item.dapodikSchoolId) {
      byDapodikId.set(item.dapodikSchoolId, item);
    }

    if (item.npsn) {
      byNpsn.set(item.npsn, item);
    }
  });

  return {
    byDapodikId,
    byNpsn
  };
};

const planSchoolMutations = ({ existingRows, normalizedRows }) => {
  const seenScopedIdentifiers = new Set();
  const skipped = [];
  const toCreate = [];
  const toUpdate = [];
  let unchangedCount = 0;

  const { byDapodikId, byNpsn: existingByNpsn } = buildExistingSchoolMaps(existingRows);

  normalizedRows.forEach((item, index) => {
    if (!item.ok) {
      skipped.push(item.reason);
      return;
    }

    const identifier = item.value.dapodikSchoolId || item.value.npsn;
    const scopedIdentifier = `${item.value.semesterId}:${identifier}`;

    if (seenScopedIdentifiers.has(scopedIdentifier)) {
      skipped.push(`Baris school ${index + 1} duplikat di dataset untuk identifier ${identifier}.`);
      return;
    }

    seenScopedIdentifiers.add(scopedIdentifier);

    const byDapodik = item.value.dapodikSchoolId ? byDapodikId.get(item.value.dapodikSchoolId) : null;
    const matchedByNpsn = item.value.npsn ? existingByNpsn.get(item.value.npsn) : null;

    if (byDapodik && matchedByNpsn && byDapodik.id !== matchedByNpsn.id) {
      skipped.push(
        `Baris school ${index + 1} konflik karena sekolah_id dan npsn mengarah ke dua staging row berbeda.`
      );
      return;
    }

    const existing = byDapodik || matchedByNpsn || null;

    if (!existing) {
      toCreate.push(item.value);
      return;
    }

    if (schoolHasChanges(existing, item.value)) {
      toUpdate.push({
        id: existing.id,
        data: item.value
      });
      return;
    }

    unchangedCount += 1;
  });

  return {
    toCreate,
    toUpdate,
    unchangedCount,
    skipped
  };
};

const applySchoolMutations = async ({ plan, batchSize }) => {
  const createdCount = await applyCreateMany({
    model: prisma.dapodikSchool,
    rows: plan.toCreate,
    batchSize
  });
  let updatedCount = 0;

  for (const item of plan.toUpdate) {
    await prisma.dapodikSchool.update({
      where: {
        id: item.id
      },
      data: item.data
    });

    updatedCount += 1;
  }

  return {
    createdCount,
    updatedCount,
    unchangedCount: plan.unchangedCount,
    skippedCount: plan.skipped.length,
    skipped: plan.skipped
  };
};

const importDapodikSchoolRows = async ({
  items,
  semesterId = env.DAPODIK_DEFAULT_SEMESTER_ID,
  fetchedAt = new Date(),
  importBatchId = buildImportBatchId({
    semesterId,
    sourceHash: sha256(JSON.stringify(items)),
    startedAt: fetchedAt
  }),
  sourceHash = sha256(JSON.stringify(items)),
  sourceLabel = MANUAL_IMPORT_ENDPOINT,
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
  lookups = {}
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Import school rows is empty.", 400, "DAPODIK_IMPORT_EMPTY");
  }

  const normalizedRows = items.map((row, index) =>
    normalizeSchoolRow({
      row,
      semesterId,
      importBatchId,
      sourceHash,
      fetchedAt,
      index,
      lookups
    })
  );

  const existingRows = await prisma.dapodikSchool.findMany({
    where: {
      semesterId
    },
    select: {
      id: true,
      semesterId: true,
      dapodikSchoolId: true,
      npsn: true,
      name: true,
      bp: true,
      bentukPendidikan: true,
      province: true,
      city: true,
      district: true,
      provinceKodeWilayah: true,
      cityKodeWilayah: true,
      districtKodeWilayah: true,
      educationLevel: true,
      schoolStatus: true,
      studentCount: true,
      kodeWilayah: true,
      idLevelWilayah: true,
      rawData: true,
      fetchedAt: true,
      lastSyncAt: true,
      sourceHash: true
    }
  });

  const plan = planSchoolMutations({
    existingRows,
    normalizedRows
  });

  const summary = {
    source: sourceLabel,
    semesterId,
    importBatchId,
    sourceHash,
    fetchedAt: fetchedAt.toISOString(),
    totalRows: items.length,
    createCount: plan.toCreate.length,
    updateCount: plan.toUpdate.length,
    unchangedCount: plan.unchangedCount,
    skippedCount: plan.skipped.length,
    skipped: plan.skipped.slice(0, 25),
    dryRun
  };

  if (dryRun) {
    return summary;
  }

  const mutationResult = await applySchoolMutations({
    plan,
    batchSize
  });

  return {
    ...summary,
    createCount: mutationResult.createdCount,
    updateCount: mutationResult.updatedCount,
    unchangedCount: mutationResult.unchangedCount,
    skippedCount: mutationResult.skippedCount,
    skipped: mutationResult.skipped.slice(0, 25)
  };
};

const importDapodikDatasetFromDirectory = async ({
  directoryPath,
  semesterId = env.DAPODIK_DEFAULT_SEMESTER_ID,
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false
}) => {
  const startedAt = new Date();
  const dataset = await loadLocalDapodikDataset({
    directoryPath
  });
  const fetchedAt = parseOptionalDate(dataset.progress?.updated_at) || startedAt;
  const importBatchId = buildImportBatchId({
    semesterId,
    sourceHash: dataset.sourceHash,
    startedAt
  });
  const regionLookupsSeed = {
    provinces: dataset.provinces.map((row, index) =>
      normalizeProvinceRow({
        row,
        semesterId,
        importBatchId,
        sourceHash: dataset.sourceHash,
        touchedAt: fetchedAt,
        index
      })
    ),
    cities: dataset.cities.map((row, index) =>
      normalizeCityRow({
        row,
        semesterId,
        importBatchId,
        sourceHash: dataset.sourceHash,
        touchedAt: fetchedAt,
        index
      })
    ),
    districts: dataset.districts.map((row, index) =>
      normalizeDistrictRow({
        row,
        semesterId,
        importBatchId,
        sourceHash: dataset.sourceHash,
        touchedAt: fetchedAt,
        index
      })
    )
  };

  const normalizedProvinces = regionLookupsSeed.provinces.filter((item) => item.ok).map((item) => item.value);
  const normalizedCities = regionLookupsSeed.cities.filter((item) => item.ok).map((item) => item.value);
  const normalizedDistricts = regionLookupsSeed.districts.filter((item) => item.ok).map((item) => item.value);
  const lookups = buildRegionLookups({
    provinces: normalizedProvinces,
    cities: normalizedCities,
    districts: normalizedDistricts
  });
  const normalizedSchools = dataset.schools.map((row, index) =>
    normalizeSchoolRow({
      row,
      semesterId,
      importBatchId,
      sourceHash: dataset.sourceHash,
      fetchedAt,
      index,
      lookups
    })
  );

  const [existingProvinces, existingCities, existingDistricts, existingSchools] = await Promise.all([
    prisma.dapodikProvince.findMany({
      select: {
        id: true,
        semesterId: true,
        kodeWilayah: true,
        name: true,
        idLevelWilayah: true,
        url: true,
        summary: true,
        rawData: true,
        sourceHash: true
      }
    }),
    prisma.dapodikCity.findMany({
      select: {
        id: true,
        semesterId: true,
        kodeWilayah: true,
        provinceKodeWilayah: true,
        name: true,
        provinceName: true,
        idLevelWilayah: true,
        url: true,
        summary: true,
        rawData: true,
        sourceHash: true
      }
    }),
    prisma.dapodikDistrict.findMany({
      select: {
        id: true,
        semesterId: true,
        kodeWilayah: true,
        provinceKodeWilayah: true,
        cityKodeWilayah: true,
        name: true,
        provinceName: true,
        cityName: true,
        idLevelWilayah: true,
        url: true,
        summary: true,
        rawData: true,
        sourceHash: true
      }
    }),
    prisma.dapodikSchool.findMany({
      where: {
        semesterId
      },
      select: {
        id: true,
        semesterId: true,
        dapodikSchoolId: true,
        npsn: true,
        name: true,
        bp: true,
        bentukPendidikan: true,
        province: true,
        city: true,
        district: true,
        provinceKodeWilayah: true,
        cityKodeWilayah: true,
        districtKodeWilayah: true,
        educationLevel: true,
        schoolStatus: true,
        studentCount: true,
        kodeWilayah: true,
        idLevelWilayah: true,
        rawData: true,
        fetchedAt: true,
        lastSyncAt: true,
        sourceHash: true
      }
    })
  ]);

  const provincePlan = await upsertRegions({
    model: prisma.dapodikProvince,
    existingRows: existingProvinces,
    normalizedRows: regionLookupsSeed.provinces,
    batchSize,
    extraKeys: []
  });
  const cityPlan = await upsertRegions({
    model: prisma.dapodikCity,
    existingRows: existingCities,
    normalizedRows: regionLookupsSeed.cities,
    batchSize,
    extraKeys: ["provinceKodeWilayah", "provinceName"]
  });
  const districtPlan = await upsertRegions({
    model: prisma.dapodikDistrict,
    existingRows: existingDistricts,
    normalizedRows: regionLookupsSeed.districts,
    batchSize,
    extraKeys: ["provinceKodeWilayah", "cityKodeWilayah", "provinceName", "cityName"]
  });
  const schoolPlan = planSchoolMutations({
    existingRows: existingSchools,
    normalizedRows: normalizedSchools
  });

  const quality = regionSummaryMeta({
    progress: dataset.progress,
    errors: dataset.errors,
    provinces: normalizedProvinces,
    schools: normalizedSchools.filter((item) => item.ok).map((item) => item.value)
  });

  const summary = {
    source: "dapodik_local_json",
    directoryPath: dataset.absoluteDirectory,
    semesterId,
    importBatchId,
    sourceHash: dataset.sourceHash,
    fetchedAt: fetchedAt.toISOString(),
    dryRun,
    files: {
      provinces: dataset.files.provinces.absolutePath,
      cities: dataset.files.cities.absolutePath,
      districts: dataset.files.districts.absolutePath,
      schools: dataset.files.schools.absolutePath,
      progress: dataset.files.progress?.absolutePath || null,
      errors: dataset.files.errors?.absolutePath || null
    },
    totals: {
      provinces: dataset.provinces.length,
      cities: dataset.cities.length,
      districts: dataset.districts.length,
      schools: dataset.schools.length
    },
    quality,
    mutations: {
      provinces: {
        createCount: provincePlan.toCreate.length,
        updateCount: provincePlan.toUpdate.length,
        unchangedCount: provincePlan.unchangedCount,
        skippedCount: provincePlan.skipped.length,
        skipped: provincePlan.skipped.slice(0, 20)
      },
      cities: {
        createCount: cityPlan.toCreate.length,
        updateCount: cityPlan.toUpdate.length,
        unchangedCount: cityPlan.unchangedCount,
        skippedCount: cityPlan.skipped.length,
        skipped: cityPlan.skipped.slice(0, 20)
      },
      districts: {
        createCount: districtPlan.toCreate.length,
        updateCount: districtPlan.toUpdate.length,
        unchangedCount: districtPlan.unchangedCount,
        skippedCount: districtPlan.skipped.length,
        skipped: districtPlan.skipped.slice(0, 20)
      },
      schools: {
        createCount: schoolPlan.toCreate.length,
        updateCount: schoolPlan.toUpdate.length,
        unchangedCount: schoolPlan.unchangedCount,
        skippedCount: schoolPlan.skipped.length,
        skipped: schoolPlan.skipped.slice(0, 25)
      }
    }
  };

  if (dryRun) {
    return summary;
  }

  const provinceResult = await applyRegionMutations({
    model: prisma.dapodikProvince,
    plan: provincePlan,
    batchSize
  });
  const cityResult = await applyRegionMutations({
    model: prisma.dapodikCity,
    plan: cityPlan,
    batchSize
  });
  const districtResult = await applyRegionMutations({
    model: prisma.dapodikDistrict,
    plan: districtPlan,
    batchSize
  });
  const schoolResult = await applySchoolMutations({
    plan: schoolPlan,
    batchSize
  });

  const finalSummary = {
    ...summary,
    mutations: {
      provinces: provinceResult,
      cities: cityResult,
      districts: districtResult,
      schools: schoolResult
    }
  };

  await createSyncLog({
    endpoint: LOCAL_IMPORT_ENDPOINT,
    status: "imported",
    params: {
      semester_id: semesterId,
      kode_wilayah: null,
      id_level_wilayah: null,
      directory_path: dataset.absoluteDirectory
    },
    resultMeta: finalSummary,
    startedAt
  });

  return finalSummary;
};

module.exports = {
  DEFAULT_BATCH_SIZE,
  LOCAL_DATASET_FILES,
  LOCAL_IMPORT_ENDPOINT,
  MANUAL_IMPORT_ENDPOINT,
  importDapodikDatasetFromDirectory,
  importDapodikSchoolRows,
  loadLocalDapodikDataset
};
