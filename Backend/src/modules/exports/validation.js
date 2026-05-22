const { z } = require("zod");

const exportTypeEnum = z.enum(["excel", "pdf"]);
const distributionStatusEnum = z.enum(["in_progress", "delivered", "failed"]);

const exportFiltersSchema = z.object({
  province: z.string().trim().optional(),
  city: z.string().trim().optional(),
  start_date: z.iso.date().optional(),
  end_date: z.iso.date().optional(),
  date: z.iso.date().optional(),
  sppgId: z.coerce.number().int().positive().optional(),
  schoolId: z.coerce.number().int().positive().optional(),
  status: distributionStatusEnum.optional()
});

const createExportSchema = z.object({
  body: z.object({
    type: exportTypeEnum,
    filters: exportFiltersSchema.optional().default({}),
    filterParams: z.record(z.string(), z.unknown()).optional()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const exportIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

module.exports = {
  createExportSchema,
  exportIdParamsSchema
};
