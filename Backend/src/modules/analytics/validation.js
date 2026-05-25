const { z } = require("zod");

const granularityEnum = z.enum(["daily", "weekly", "monthly"]);
const publicReportCategoryEnum = z.enum(["kualitas_makanan", "keterlambatan", "kekurangan_porsi", "lainnya"]);
const publicReportStatusEnum = z.enum(["baru", "ditinjau", "ditindak", "ditutup"]);
const commaSeparatedPublicReportStatuses = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => {
      if (!value) return true;
      return value
        .split(",")
        .map((item) => item.trim())
        .every((item) => publicReportStatusEnum.safeParse(item).success);
    },
    {
      message: "Invalid public report status filter."
    }
  );

const baseAnalyticsQuerySchema = z.object({
  province: z.string().trim().optional(),
  city: z.string().trim().optional(),
  start_date: z.iso.date().optional(),
  end_date: z.iso.date().optional()
});

const summarySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema
});

const publicReportsAnalyticsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema.extend({
    category: publicReportCategoryEnum.optional(),
    status: commaSeparatedPublicReportStatuses,
    dateFrom: z.string().trim().optional(),
    dateTo: z.string().trim().optional(),
    limit: z.coerce.number().int().positive().max(50).optional().default(10)
  })
});

const distributionsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema.extend({
    granularity: granularityEnum.optional().default("daily")
  })
});

const successRateSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema.extend({
    granularity: granularityEnum.optional().default("daily")
  })
});

const budgetSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema
});

const byProvinceSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema.extend({
    limit: z.coerce.number().int().positive().max(50).optional().default(10)
  })
});

const anomalySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema.extend({
    is_resolved: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
  })
});

const priceAnomaliesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseAnalyticsQuerySchema.extend({
    is_resolved: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
});

module.exports = {
  anomalySchema,
  budgetSchema,
  byProvinceSchema,
  distributionsSchema,
  priceAnomaliesSchema,
  publicReportsAnalyticsSchema,
  successRateSchema,
  summarySchema
};
