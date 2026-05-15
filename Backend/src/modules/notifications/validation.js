const { z } = require("zod");

const notificationTypeEnum = z.enum(["distribution", "validation", "anomaly", "system"]);

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

const listNotificationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    is_read: booleanQuerySchema.optional(),
    type: notificationTypeEnum.optional()
  })
});

const notificationIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const readAllNotificationsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  listNotificationsSchema,
  notificationIdParamsSchema,
  readAllNotificationsSchema
};
