const { z } = require("zod");

const distributionProofsParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createProofSchema = z.object({
  body: z.object({
    distributionId: z.coerce.number().int().positive(),
    fileId: z.coerce.number().int().positive()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  createProofSchema,
  distributionProofsParamsSchema
};
