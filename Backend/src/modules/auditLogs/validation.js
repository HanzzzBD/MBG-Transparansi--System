const { z } = require("zod");

const auditActionEnum = z.enum(["INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "LOCK", "UNLOCK", "OVERRIDE"]);
const auditCategoryEnum = z.enum(["Data", "User", "Security", "System"]);
const auditSeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

const listAuditLogsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: z.string().trim().optional(),
    table_name: z.string().trim().min(1).optional(),
    tableName: z.string().trim().min(1).optional(),
    user_id: z.coerce.number().int().positive().optional(),
    userId: z.coerce.number().int().positive().optional(),
    action: auditActionEnum.optional(),
    category: auditCategoryEnum.optional(),
    severity: auditSeverityEnum.optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional()
  })
});

const auditLogIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

module.exports = {
  auditLogIdParamsSchema,
  listAuditLogsSchema
};
