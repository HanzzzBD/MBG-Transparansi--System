const { z } = require("zod");

const apiIdSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.enum(["auth-service", "reporting-api", "export-queue", "background-jobs"])
  }),
  query: z.object({}).optional().default({})
});

const syncSourceIdSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.enum(["sp2kp-sync", "dapodik-sync"])
  }),
  query: z.object({}).optional().default({})
});

module.exports = {
  apiIdSchema,
  syncSourceIdSchema
};
