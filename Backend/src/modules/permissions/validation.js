const { z } = require("zod");

const permissionKeySchema = z.string().trim().min(1).max(255);
const reasonSchema = z.string().trim().max(500).optional();

const userPermissionParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const userPermissionMutationSchema = z.object({
  body: z.object({
    permissionKey: permissionKeySchema,
    reason: reasonSchema
  }),
  params: userPermissionParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const userPermissionKeyParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive(),
    permissionKey: permissionKeySchema
  }),
  query: z.object({}).optional().default({})
});

module.exports = {
  userPermissionKeyParamsSchema,
  userPermissionMutationSchema,
  userPermissionParamsSchema
};
