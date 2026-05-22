const { z } = require("zod");

const baseQuery = z.object({
  date: z.iso.date().optional(),
  province: z.string().trim().optional(),
  city: z.string().trim().optional(),
  variant: z.string().trim().optional(),
  scope: z.enum(["national", "province", "city"]).optional(),
  latest: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const listFoodPricesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseQuery
});

const latestFoodPricesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: baseQuery.omit({
    latest: true,
    page: true,
    limit: true
  })
});

const estimateSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    province: z.string().trim().min(1)
  })
});

const importFoodPricesSchema = z.object({
  body: z.object({
    path: z.string().trim().min(1),
    dryRun: z.coerce.boolean().optional().default(false),
    force: z.coerce.boolean().optional().default(false),
    all: z.coerce.boolean().optional().default(false),
    latest: z.coerce.boolean().optional().default(false),
    since: z.iso.date().optional(),
    limit: z.coerce.number().int().positive().optional()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  estimateSchema,
  importFoodPricesSchema,
  latestFoodPricesSchema,
  listFoodPricesSchema
};
