const { z } = require("zod");

const searchQuerySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    q: z.string().trim().max(100).optional().default(""),
    limit: z.coerce.number().int().min(1).max(10).optional().default(5)
  })
});

module.exports = {
  searchQuerySchema
};
