const { z } = require("zod");

const dashboardSummarySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional()
  })
});

module.exports = {
  dashboardSummarySchema
};
