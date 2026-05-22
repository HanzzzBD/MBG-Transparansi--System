const fs = require("fs");
const path = require("path");

const { getPrismaClient } = require("../../config/prisma");

const EMPTY_VALUES = new Set(["", "-", "null", "undefined"]);

const isEmpty = (value) => value === null || value === undefined || EMPTY_VALUES.has(String(value).trim());

const cleanString = (value) => {
  if (isEmpty(value)) {
    return null;
  }

  return String(value).trim();
};

const parseNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (isEmpty(value)) {
    return null;
  }

  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateOnly = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const raw = cleanString(value);
  if (!raw) {
    return null;
  }

  const datePart = raw.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateOnly = (value) => {
  const date = parseDateOnly(value);
  return date ? date.toISOString().slice(0, 10) : null;
};

const extractDateFromFileName = (filePath) => {
  const match = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? parseDateOnly(match[1]) : null;
};

const normalizeRecord = ({ record, fileMeta = {} }) => {
  const date = parseDateOnly(record.date ?? record.tanggal ?? fileMeta.date);
  const price = parseNumber(record.harga ?? record.price ?? record.nilai);
  const variantIdRaw = parseNumber(record.variant_id ?? record.variantId ?? record.commodity_id);
  const variant = cleanString(record.variant ?? record.commodity ?? record.komoditas);

  if (!date || price === null || variantIdRaw === null || !variant) {
    return {
      valid: false,
      reason: "Missing required date, price, variant_id, or variant."
    };
  }

  const provinceCode = cleanString(record.kode_provinsi ?? record.provinceCode);
  const cityCode = cleanString(record.kode_kab_kota ?? record.cityCode);

  return {
    valid: true,
    data: {
      date,
      source: cleanString(record.source ?? fileMeta.source) || "SP2KP Kemendag",
      scope: cleanString(record.scope) || (cityCode ? "city" : provinceCode ? "province" : "national"),
      level: cleanString(record.level),
      provinceCode,
      province: cleanString(record.nama_provinsi ?? record.province),
      cityCode,
      city: cleanString(record.nama_kab_kota ?? record.city),
      variantId: Math.trunc(variantIdRaw),
      variant,
      unit: cleanString(record.satuan ?? record.unit) || "unit",
      quantity: parseNumber(record.kuantitas ?? record.quantity) || 1,
      price,
      sourceEndpoint: cleanString(record.source_endpoint ?? record.sourceEndpoint),
      rawData: record
    }
  };
};

const collectJsonFiles = (targetPath) => {
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    if (!resolved.toLowerCase().endsWith(".json")) {
      throw new Error(`File is not JSON: ${resolved}`);
    }

    return [resolved];
  }

  if (!stat.isDirectory()) {
    throw new Error(`Path is not a JSON file or directory: ${resolved}`);
  }

  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        files.push(entryPath);
      }
    }
  };

  walk(resolved);
  return files.sort();
};

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const readFileMetadata = (filePath) => {
  try {
    const parsed = readJsonFile(filePath);
    const date =
      parseDateOnly(parsed.date) ||
      parseDateOnly(parsed.generated_at ?? parsed.generatedAt) ||
      extractDateFromFileName(filePath);

    if (!date) {
      return {
        valid: false,
        filePath,
        message: "JSON file has no valid date, generated_at, or YYYY-MM-DD filename."
      };
    }

    return {
      valid: true,
      filePath,
      date,
      dateStr: formatDateOnly(date),
      source: parsed.source || null
    };
  } catch (error) {
    return {
      valid: false,
      filePath,
      message: error.message
    };
  }
};

const selectImportFiles = ({ targetPath, all = false, latest = false, since } = {}) => {
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    if (!resolved.toLowerCase().endsWith(".json")) {
      throw new Error(`File is not JSON: ${resolved}`);
    }

    const metadata = readFileMetadata(resolved);

    return {
      mode: "single",
      selectedFiles: [resolved],
      latestDate: metadata.valid ? metadata.dateStr : null,
      skippedFiles: metadata.valid
        ? []
        : [
            {
              file: resolved,
              message: metadata.message
            }
          ],
      discoveredFiles: 1
    };
  }

  if (!stat.isDirectory()) {
    throw new Error(`Path is not a JSON file or directory: ${resolved}`);
  }

  const files = collectJsonFiles(resolved);
  const metadataRows = files.map(readFileMetadata);
  const validRows = metadataRows.filter((row) => row.valid);
  const skippedFiles = metadataRows
    .filter((row) => !row.valid)
    .map((row) => ({
      file: row.filePath,
      message: row.message
    }));

  if (latest || (!all && !since)) {
    const latestRow = validRows.sort((first, second) => {
      const diff = second.date.getTime() - first.date.getTime();
      return diff !== 0 ? diff : first.filePath.localeCompare(second.filePath);
    })[0];

    return {
      mode: "latest",
      selectedFiles: latestRow ? [latestRow.filePath] : [],
      latestDate: latestRow?.dateStr || null,
      skippedFiles,
      discoveredFiles: files.length
    };
  }

  if (since) {
    const sinceDate = parseDateOnly(since);

    if (!sinceDate) {
      throw new Error("--since must be a valid YYYY-MM-DD date.");
    }

    const selectedRows = validRows
      .filter((row) => row.date >= sinceDate)
      .sort((first, second) => first.date.getTime() - second.date.getTime());

    return {
      mode: "since",
      selectedFiles: selectedRows.map((row) => row.filePath),
      latestDate: selectedRows.length ? selectedRows[selectedRows.length - 1].dateStr : null,
      skippedFiles,
      discoveredFiles: files.length
    };
  }

  return {
    mode: "all",
    selectedFiles: validRows
      .sort((first, second) => first.date.getTime() - second.date.getTime())
      .map((row) => row.filePath),
    latestDate: validRows.length
      ? validRows.sort((first, second) => second.date.getTime() - first.date.getTime())[0].dateStr
      : null,
    skippedFiles,
    discoveredFiles: files.length
  };
};

const saveFoodPrice = async ({ prisma, data }) => {
  const existing = await prisma.foodPrice.findFirst({
    where: {
      date: data.date,
      scope: data.scope,
      provinceCode: data.provinceCode,
      cityCode: data.cityCode,
      variantId: data.variantId
    },
    select: {
      id: true
    }
  });

  if (existing) {
    await prisma.foodPrice.update({
      where: {
        id: existing.id
      },
      data
    });

    return "updated";
  }

  await prisma.foodPrice.create({
    data
  });

  return "inserted";
};

const foodPricesExistForDate = async ({ prisma, date }) => {
  const parsedDate = parseDateOnly(date);

  if (!parsedDate) {
    return false;
  }

  const count = await prisma.foodPrice.count({
    where: {
      date: parsedDate
    }
  });

  return count > 0;
};

const importFoodPrices = async ({
  targetPath,
  dryRun = false,
  limit,
  prisma,
  all = false,
  latest = false,
  since,
  force = false
} = {}) => {
  if (!targetPath) {
    throw new Error("Path is required.");
  }

  const selection = selectImportFiles({
    targetPath,
    all,
    latest,
    since
  });
  const summary = {
    dryRun,
    mode: selection.mode,
    selectedFiles: selection.selectedFiles,
    latestDate: selection.latestDate,
    alreadyExists: false,
    totalFiles: selection.selectedFiles.length,
    discoveredFiles: selection.discoveredFiles,
    totalRecords: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [...selection.skippedFiles]
  };

  const db = dryRun ? null : prisma || getPrismaClient();

  if (!dryRun && selection.mode === "latest" && selection.latestDate) {
    summary.alreadyExists = await foodPricesExistForDate({
      prisma: db,
      date: selection.latestDate
    });

    if (summary.alreadyExists && !force) {
      summary.message = `Data harga pangan tanggal ${selection.latestDate} sudah ada, skip import. Gunakan --force untuk import ulang.`;
      return summary;
    }
  }

  let processed = 0;

  for (const filePath of selection.selectedFiles) {
    let parsed;

    try {
      parsed = readJsonFile(filePath);
    } catch (error) {
      summary.errors.push({
        file: filePath,
        message: error.message
      });
      continue;
    }

    const records = Array.isArray(parsed.records) ? parsed.records : Array.isArray(parsed) ? parsed : [];
    const metadata = readFileMetadata(filePath);
    const fileMeta = {
      date: parsed.date ?? parsed.generated_at ?? parsed.generatedAt ?? metadata.dateStr,
      source: parsed.source
    };

    summary.totalRecords += records.length;

    for (const [index, record] of records.entries()) {
      if (limit && processed >= Number(limit)) {
        return summary;
      }

      try {
        const normalized = normalizeRecord({ record, fileMeta });

        if (!normalized.valid) {
          summary.skipped += 1;
          summary.errors.push({
            file: filePath,
            index,
            message: normalized.reason
          });
          processed += 1;
          continue;
        }

        if (dryRun) {
          summary.inserted += 1;
          processed += 1;
          continue;
        }

        const action = await saveFoodPrice({
          prisma: db,
          data: normalized.data
        });

        summary[action] += 1;
        processed += 1;
      } catch (error) {
        summary.skipped += 1;
        summary.errors.push({
          file: filePath,
          index,
          message: error.message
        });
        processed += 1;
      }
    }
  }

  return summary;
};

module.exports = {
  collectJsonFiles,
  foodPricesExistForDate,
  importFoodPrices,
  normalizeRecord,
  readFileMetadata,
  selectImportFiles
};
