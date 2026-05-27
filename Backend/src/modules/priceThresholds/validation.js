const { z } = require("zod");

const listPriceThresholdsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    province: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional()
  })
});

const generatePriceThresholdsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const myRegionPriceThresholdSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  generatePriceThresholdsSchema,
  listPriceThresholdsSchema,
  myRegionPriceThresholdSchema
};
