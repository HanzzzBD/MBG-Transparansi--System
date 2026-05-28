const { z } = require("zod");
const AppError = require("../../utils/appError");

const exportTypeEnum = z.enum(["excel", "pdf"]);
const distributionStatusEnum = z.enum(["in_progress", "delivered", "failed"]);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const exportFiltersSchema = z.object({
  province: z.string().trim().optional(),
  city: z.string().trim().optional(),
  start_date: z.iso.date().optional(),
  end_date: z.iso.date().optional(),
  date: z.iso.date().optional(),
  sppgId: z.coerce.number().int().positive().optional(),
  schoolId: z.coerce.number().int().positive().optional(),
  status: distributionStatusEnum.optional()
});

const createExportSchema = z.object({
  body: z.object({
    type: exportTypeEnum,
    filters: exportFiltersSchema.optional().default({}),
    filterParams: z.record(z.string(), z.unknown()).optional()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const exportIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const normalizeExportDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new AppError("Filter tanggal export tidak valid.", 400, "EXPORT_FILTER_DATE_INVALID");
    }

    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!DATE_ONLY_PATTERN.test(text)) {
    throw new AppError("Filter tanggal export tidak valid.", 400, "EXPORT_FILTER_DATE_INVALID");
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AppError("Filter tanggal export tidak valid.", 400, "EXPORT_FILTER_DATE_INVALID");
  }

  return text;
};

const getFirstDateValue = (filters, keys) => {
  for (const key of keys) {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
      return filters[key];
    }
  }

  return null;
};

const assertValidExportDateFilters = (filters = {}) => {
  const exactDate = normalizeExportDate(filters.date);
  const startDate = normalizeExportDate(getFirstDateValue(filters, ["start_date", "dateFrom", "date_from"]));
  const endDate = normalizeExportDate(getFirstDateValue(filters, ["end_date", "dateTo", "date_to"]));

  if (startDate && endDate && startDate > endDate) {
    throw new AppError(
      "Tanggal awal export tidak boleh lebih besar dari tanggal akhir.",
      400,
      "EXPORT_FILTER_DATE_RANGE_INVALID"
    );
  }

  return {
    date: exactDate,
    startDate,
    endDate
  };
};

module.exports = {
  assertValidExportDateFilters,
  createExportSchema,
  exportIdParamsSchema
};
