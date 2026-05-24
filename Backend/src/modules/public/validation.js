const { z } = require("zod");

const publicSppgStatusEnum = z.enum(["active", "inactive", "problem"]);

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

module.exports = {
  publicSppgListSchema,
  publicSppgIdParamsSchema
};
