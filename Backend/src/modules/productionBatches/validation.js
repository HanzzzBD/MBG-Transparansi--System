const { z } = require("zod");

const batchIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const listProductionBatchesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    sppgId: z.coerce.number().int().positive().optional(),
    date: z.iso.date().optional(),
    province: z.string().trim().optional()
  })
});

const productionBatchBodySchema = z.object({
  sppgId: z.coerce.number().int().positive().optional(),
  menuId: z.coerce.number().int().positive().optional().nullable(),
  productionDate: z.iso.date(),
  totalPortions: z.coerce.number().int().positive(),
  operationalCost: z.coerce.number().nonnegative().optional().default(0),
  packagingCost: z.coerce.number().nonnegative().optional().default(0),
  distributionCost: z.coerce.number().nonnegative().optional().default(0),
  notes: z.string().trim().max(2000).optional().nullable()
});

const createProductionBatchSchema = z.object({
  body: productionBatchBodySchema,
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const updateProductionBatchSchema = z.object({
  body: productionBatchBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: batchIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const productionBatchItemBodySchema = z.object({
  commodityName: z.string().trim().min(1).max(255),
  variantId: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(50),
  unitPrice: z.coerce.number().positive()
});

const createProductionBatchItemSchema = z.object({
  body: productionBatchItemBodySchema,
  params: batchIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const updateProductionBatchItemSchema = z.object({
  body: productionBatchItemBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: batchIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  batchIdParamsSchema,
  createProductionBatchItemSchema,
  createProductionBatchSchema,
  listProductionBatchesSchema,
  updateProductionBatchItemSchema,
  updateProductionBatchSchema
};
