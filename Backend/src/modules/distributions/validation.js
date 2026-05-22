const { z } = require("zod");

const distributionStatusEnum = z.enum(["in_progress", "delivered", "failed"]);

const listDistributionsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    date: z.iso.date().optional(),
    sppgId: z.coerce.number().int().positive().optional(),
    schoolId: z.coerce.number().int().positive().optional(),
    status: distributionStatusEnum.optional()
  })
});

const distributionIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createDistributionSchema = z.object({
  body: z.object({
    sppgId: z.coerce.number().int().positive().optional(),
    schoolId: z.coerce.number().int().positive(),
    productionBatchId: z.coerce.number().int().positive().optional().nullable(),
    portions: z.coerce.number().int().positive(),
    pricePerPortion: z.coerce.number().positive().optional(),
    distributionDate: z.iso.date(),
    status: distributionStatusEnum.optional(),
    failureReason: z.string().trim().max(1000).optional().nullable()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const updateDistributionSchema = z.object({
  body: createDistributionSchema.shape.body.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: distributionIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  createDistributionSchema,
  distributionIdParamsSchema,
  listDistributionsSchema,
  updateDistributionSchema
};
