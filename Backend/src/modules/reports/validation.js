const { z } = require("zod");

const reportCategoryEnum = z.enum(["kualitas_makanan", "keterlambatan", "kekurangan_porsi", "lainnya"]);
const publicReportStatusEnum = z.enum(["baru", "ditinjau", "ditindak", "ditutup"]);
const commaSeparatedPublicReportStatuses = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => {
      if (!value) return true;
      return value
        .split(",")
        .map((item) => item.trim())
        .every((item) => publicReportStatusEnum.safeParse(item).success);
    },
    {
      message: "Invalid public report status filter."
    }
  );

const listPublicReportsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    category: reportCategoryEnum.optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    status: commaSeparatedPublicReportStatuses,
    dateFrom: z.string().trim().optional(),
    dateTo: z.string().trim().optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional()
  })
});

const publicReportIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const updatePublicReportStatusSchema = z.object({
  body: z
    .object({
      status: publicReportStatusEnum,
      followUpNote: z.string().trim().min(10).max(4000).optional().nullable(),
      follow_up_note: z.string().trim().min(10).max(4000).optional().nullable(),
      note: z.string().trim().min(10).max(4000).optional().nullable()
    })
    .transform((value) => ({
      status: value.status,
      followUpNote: value.followUpNote ?? value.follow_up_note ?? value.note ?? null
    })),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
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
  listSchoolReportsSchema,
  publicReportIdParamsSchema,
  updatePublicReportStatusSchema
};
