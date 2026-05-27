const { z } = require("zod");

const publicSppgStatusEnum = z.enum(["active", "inactive", "problem"]);
const granularityEnum = z.enum(["daily", "weekly", "monthly"]);

const publicAnalyticsQuerySchema = z.object({
  province: z.string().trim().optional(),
  city: z.string().trim().optional(),
  start_date: z.iso.date().optional(),
  end_date: z.iso.date().optional(),
  granularity: granularityEnum.optional().default("daily"),
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

const publicSppgListSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    status: publicSppgStatusEnum.optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
});

const publicSppgIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const publicStatisticsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: publicAnalyticsQuerySchema
});

const publicBudgetSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: publicAnalyticsQuerySchema
});

module.exports = {
  publicBudgetSchema,
  publicStatisticsSchema,
  publicSppgListSchema,
  publicSppgIdParamsSchema
};
