const { z } = require("zod");

const validationStatusEnum = z.enum(["verified", "conflict", "pending", "issue_reported"]);

const listValidationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    schoolId: z.coerce.number().int().positive().optional(),
    status: validationStatusEnum.optional()
  })
});

const validationIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const updateValidationSchema = z.object({
  body: z.object({
    receivedPortions: z.coerce.number().int().nonnegative().optional(),
    qualityOk: z.boolean().optional().nullable(),
    status: validationStatusEnum.optional(),
    notes: z.string().trim().max(2000).optional().nullable()
  }).refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: validationIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  listValidationsSchema,
  updateValidationSchema,
  validationIdParamsSchema
};
