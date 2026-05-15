const { z } = require("zod");

const issueCategoryEnum = z.enum(["logistik", "keterlambatan", "kekurangan_bahan", "peralatan", "lainnya"]);
const issueStatusEnum = z.enum(["open", "in_progress", "resolved"]);

const listIssuesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    sppgId: z.coerce.number().int().positive().optional(),
    category: issueCategoryEnum.optional(),
    status: issueStatusEnum.optional()
  })
});

const issueIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createIssueSchema = z.object({
  body: z.object({
    sppgId: z.coerce.number().int().positive().optional(),
    category: issueCategoryEnum,
    description: z.string().trim().min(1).max(2000)
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const updateIssueStatusSchema = z.object({
  body: z.object({
    status: issueStatusEnum
  }),
  params: issueIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  createIssueSchema,
  issueIdParamsSchema,
  listIssuesSchema,
  updateIssueStatusSchema
};
