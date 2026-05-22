const fs = require("fs/promises");
const path = require("path");

const { env } = require("../config/env");
const { getPrismaClient } = require("../config/prisma");
const { createAuditLog } = require("../utils/auditLog");

const prisma = getPrismaClient();

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CAPACITY_FALLBACK = 1;
const VALID_STATUSES = new Set(["active", "inactive", "problem"]);

const collapseWhitespace = (value) => value.replace(/\s+/g, " ").trim();

const normalizeRegionText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const collapsed = collapseWhitespace(value);

  if (!collapsed) {
    return null;
  }

  if (/^(?:[A-Za-z]\s+){2,}[A-Za-z]$/.test(collapsed)) {
    return collapsed.replace(/\s+/g, "").toUpperCase();
  }

  return collapsed.toUpperCase();
};

const normalizeText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const collapsed = collapseWhitespace(value);
  return collapsed || null;
};

const parseWilayahText = (value) => {
  if (typeof value !== "string") {
    return {};
  }

  return value.split("|").reduce((result, segment) => {
    const [rawKey, ...rawValueParts] = segment.split(":");
    const key = normalizeText(rawKey)?.toLowerCase();
    const text = normalizeText(rawValueParts.join(":"));

    if (!key || !text) {
      return result;
    }

    if (key.includes("provinsi")) {
      result.province = text;
    }

    if (key.includes("kab") || key.includes("kota")) {
      result.city = text;
    }

    return result;
  }, {});
};

const normalizeFloat = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCapacity = (value, fallbackCapacity) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallbackCapacity;
};

const normalizeStatus = (value) => {
  if (typeof value !== "string") {
    return "active";
  }

  const normalized = value.trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : "active";
};

const buildSppgKey = (item) =>
  [
    item.name?.toLowerCase() || "",
    item.province?.toLowerCase() || "",
    item.city?.toLowerCase() || "",
    item.address?.toLowerCase() || ""
  ].join("|");

const hasSppgChanges = (existing, nextValue) =>
  existing.name !== nextValue.name ||
  existing.province !== nextValue.province ||
  existing.city !== nextValue.city ||
  (existing.address || null) !== (nextValue.address || null) ||
  (existing.lat ?? null) !== (nextValue.lat ?? null) ||
  (existing.lng ?? null) !== (nextValue.lng ?? null) ||
  existing.capacity !== nextValue.capacity ||
  existing.status !== nextValue.status;

const chunkArray = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const parseArgs = (argv) => {
  const args = argv.slice(2);
  const options = {
    filePath: null,
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    defaultCapacity: env.SPPG_DEFAULT_CAPACITY || DEFAULT_CAPACITY_FALLBACK
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--batch-size") {
      const nextValue = args[index + 1];
      const parsed = Number.parseInt(nextValue, 10);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Nilai --batch-size harus berupa integer positif.");
      }

      options.batchSize = parsed;
      index += 1;
      continue;
    }

    if (arg === "--default-capacity") {
      const nextValue = args[index + 1];
      const parsed = Number.parseInt(nextValue, 10);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Nilai --default-capacity harus berupa integer lebih dari 0.");
      }

      options.defaultCapacity = parsed;
      index += 1;
      continue;
    }

    if (!options.filePath) {
      options.filePath = arg;
      continue;
    }

    throw new Error(`Argumen tidak dikenal: ${arg}`);
  }

  if (!options.filePath) {
    options.filePath = env.SPPG_IMPORT_PATH || null;
  }

  if (!options.filePath) {
    throw new Error(
      "Path file JSON wajib diberikan. Contoh: npm run import:sppg -- C:\\path\\dapur_sppg_geocoded.json atau set SPPG_IMPORT_PATH di .env"
    );
  }

  return options;
};

const loadJsonFile = async (filePath) => {
  const absolutePath = path.resolve(filePath);
  const rawContent = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(rawContent);

  if (!Array.isArray(parsed)) {
    throw new Error("File JSON harus berupa array object.");
  }

  return {
    absolutePath,
    items: parsed
  };
};

const normalizeSppgItem = (item, index, defaultCapacity) => {
  const wilayah = parseWilayahText(item?.wilayah);
  const name = normalizeText(item?.name ?? item?.nama);
  const province = normalizeRegionText(item?.province ?? item?.provinsi ?? wilayah.province);
  const city = normalizeRegionText(item?.city ?? item?.kabKota ?? item?.kab_kota ?? item?.kabupaten ?? wilayah.city);

  if (!name || !province || !city) {
    return {
      ok: false,
      reason: `Baris ${index + 1} tidak punya field wajib name/province/city yang valid.`
    };
  }

  const capacitySource = item?.capacity ?? item?.kapasitas;
  const normalizedCapacity = normalizeCapacity(capacitySource, defaultCapacity);
  const capacityWasAdjusted = normalizedCapacity !== Number.parseInt(capacitySource, 10);

  return {
    ok: true,
    value: {
      name,
      province,
      city,
      address: normalizeText(item?.address ?? item?.alamat),
      lat: normalizeFloat(item?.lat),
      lng: normalizeFloat(item?.lng),
      capacity: normalizedCapacity,
      status: normalizeStatus(item?.status)
    },
    meta: {
      capacityWasAdjusted
    }
  };
};

const importSppgFromJson = async ({
  filePath,
  dryRun = false,
  batchSize = DEFAULT_BATCH_SIZE,
  defaultCapacity = DEFAULT_CAPACITY_FALLBACK
}) => {
  const { absolutePath, items } = await loadJsonFile(filePath);
  const existingRecords = await prisma.sppg.findMany({
    where: {
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
      status: true
    }
  });

  const existingMap = new Map(existingRecords.map((record) => [buildSppgKey(record), record]));
  const seenImportKeys = new Set();
  const toCreate = [];
  const toUpdate = [];
  const skipped = [];
  let adjustedCapacityCount = 0;

  items.forEach((item, index) => {
    const normalized = normalizeSppgItem(item, index, defaultCapacity);

    if (!normalized.ok) {
      skipped.push(normalized.reason);
      return;
    }

    if (normalized.meta?.capacityWasAdjusted) {
      adjustedCapacityCount += 1;
    }

    const key = buildSppgKey(normalized.value);

    if (seenImportKeys.has(key)) {
      skipped.push(`Baris ${index + 1} duplikat di dalam file import.`);
      return;
    }

    seenImportKeys.add(key);

    const existing = existingMap.get(key);

    if (!existing) {
      toCreate.push(normalized.value);
      return;
    }

    if (hasSppgChanges(existing, normalized.value)) {
      toUpdate.push({
        existing,
        nextValue: normalized.value
      });
    }
  });

  const summary = {
    filePath: absolutePath,
    totalRows: items.length,
    createCount: toCreate.length,
    updateCount: toUpdate.length,
    skippedCount: skipped.length,
    adjustedCapacityCount,
    defaultCapacity,
    dryRun
  };

  if (dryRun) {
    return {
      summary,
      skipped
    };
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const chunk of chunkArray(toCreate, batchSize)) {
    // Create sequentially inside transactions so each mutation still writes audit logs.
    for (const data of chunk) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.sppg.create({
          data
        });

        await createAuditLog({
          prisma: tx,
          action: "INSERT",
          tableName: "sppg",
          recordId: created.id,
          newData: created,
          ipAddress: "script:import-sppg"
        });
      });

      createdCount += 1;
    }
  }

  for (const chunk of chunkArray(toUpdate, batchSize)) {
    for (const item of chunk) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.sppg.update({
          where: {
            id: item.existing.id
          },
          data: item.nextValue
        });

        await createAuditLog({
          prisma: tx,
          action: "UPDATE",
          tableName: "sppg",
          recordId: updated.id,
          oldData: item.existing,
          newData: updated,
          ipAddress: "script:import-sppg"
        });
      });

      updatedCount += 1;
    }
  }

  return {
    summary: {
      ...summary,
      createdCount,
      updatedCount
    },
    skipped
  };
};

const runCli = async () => {
  const options = parseArgs(process.argv);
  const result = await importSppgFromJson(options);

  console.log("Import SPPG selesai.");
  console.log(JSON.stringify(result.summary, null, 2));

  if (result.skipped.length > 0) {
    console.log("\nBaris yang dilewati:");
    result.skipped.slice(0, 20).forEach((message) => {
      console.log(`- ${message}`);
    });

    if (result.skipped.length > 20) {
      console.log(`- dan ${result.skipped.length - 20} baris lainnya`);
    }
  }
};

if (require.main === module) {
  runCli()
    .catch((error) => {
      console.error("Import SPPG gagal:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  importSppgFromJson
};
