const { z } = require("zod");

const distributionStatusEnum = z.enum(["draft", "pending", "in_progress", "sent", "delivered", "failed"]);

const listDistributionsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    date: z.iso.date().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    search: z.string().trim().optional(),
    province: z.string().trim().optional(),
    isLocked: z.coerce.boolean().optional(),
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
    menuId: z.coerce.number().int().positive().optional().nullable(),
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

const distributionLockSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(10, "Reason must be at least 10 characters long.").max(1000),
    autoRelockAfterOneHour: z.boolean().optional()
  }),
  params: distributionIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const overrideChangesSchema = z.object({
  sppgId: z.coerce.number().int().positive().optional(),
  schoolId: z.coerce.number().int().positive().optional(),
  menuId: z.coerce.number().int().positive().optional().nullable(),
  productionBatchId: z.coerce.number().int().positive().optional().nullable(),
  portions: z.coerce.number().int().positive().optional(),
  pricePerPortion: z.coerce.number().positive().optional(),
  distributionDate: z.iso.date().optional(),
  status: distributionStatusEnum.optional(),
  failureReason: z.string().trim().max(1000).optional().nullable()
});

const distributionOverrideSchema = z.object({
  body: z
    .object({
      changes: overrideChangesSchema.optional(),
      reason: z.string().trim().min(20, "Reason must be at least 20 characters long.").max(1000),
      confirmAudit: z.boolean().optional()
    })
    .refine((value) => value.changes && Object.keys(value.changes).length > 0, {
      message: "At least one override change must be provided.",
      path: ["changes"]
    }),
  params: distributionIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  createDistributionSchema,
  distributionLockSchema,
  distributionOverrideSchema,
  distributionIdParamsSchema,
  listDistributionsSchema,
  updateDistributionSchema
};
