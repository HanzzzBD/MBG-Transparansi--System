const { z } = require("zod");

const reportCategoryEnum = z.enum(["kualitas_makanan", "keterlambatan", "kekurangan_porsi", "lainnya"]);

const listPublicReportsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    category: reportCategoryEnum.optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional()
  })
});

const createPublicReportSchema = z.object({
  body: z
    .object({
      reporterName: z.string().trim().max(255).optional().nullable(),
      category: reportCategoryEnum,
      message: z.string().trim().min(20, "Message must be at least 20 characters long.").max(4000),
      province: z.string().trim().max(255).optional().nullable(),
      city: z.string().trim().max(255).optional().nullable(),
      captchaToken: z.string().trim().optional(),
      captcha_token: z.string().trim().optional(),
      hpField: z.string().optional(),
      hp_field: z.string().optional()
    })
    .superRefine((value, ctx) => {
      const captchaToken = value.captchaToken || value.captcha_token;

      if (!captchaToken || !captchaToken.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["captchaToken"],
          message: "captchaToken is required."
        });
      }
    })
    .transform((value) => ({
      reporterName: value.reporterName ?? null,
      category: value.category,
      message: value.message,
      province: value.province ?? null,
      city: value.city ?? null,
      captchaToken: (value.captchaToken || value.captcha_token || "").trim(),
      hpField: value.hpField ?? value.hp_field ?? ""
    })),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const listSchoolReportsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    schoolId: z.coerce.number().int().positive().optional(),
    category: reportCategoryEnum.optional()
  })
});

const createSchoolReportSchema = z.object({
  body: z.object({
    schoolId: z.coerce.number().int().positive().optional(),
    category: reportCategoryEnum,
    message: z.string().trim().min(1).max(4000)
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  createPublicReportSchema,
  createSchoolReportSchema,
  listPublicReportsSchema,
  listSchoolReportsSchema
};
