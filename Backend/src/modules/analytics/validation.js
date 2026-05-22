const { z } = require("zod");

const granularityEnum = z.enum(["daily", "weekly", "monthly"]);

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
  successRateSchema,
  summarySchema
};
