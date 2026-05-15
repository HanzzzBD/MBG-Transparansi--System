const { z } = require("zod");

const listSchoolsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    sppgId: z.coerce.number().int().positive().optional()
  })
});

const schoolIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createSchoolSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(255),
    province: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(255),
    address: z.string().trim().max(500).optional().nullable(),
    sppgId: z.coerce.number().int().positive(),
    totalStudents: z.coerce.number().int().nonnegative().default(0)
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const updateSchoolSchema = z.object({
  body: createSchoolSchema.shape.body.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: schoolIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  createSchoolSchema,
  listSchoolsSchema,
  schoolIdParamsSchema,
  updateSchoolSchema
};
