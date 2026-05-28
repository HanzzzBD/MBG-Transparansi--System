const { z } = require("zod");

const listMenusSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    sppgId: z.coerce.number().int().positive().optional(),
    date: z.iso.date().optional(),
    priceValidationStatus: z.enum(["PENDING_REVIEW", "VERIFIED", "MISMATCH"]).optional()
  })
});

const menuIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createMenuSchema = z.object({
  body: z.object({
    sppgId: z.coerce.number().int().positive().optional(),
    menuDate: z.iso.date(),
    menuName: z.string().trim().min(1).max(255),
    items: z.array(z.string().trim().min(1).max(255)).min(1).max(30).optional(),
    photoFileId: z.coerce.number().int().positive().optional().nullable(),
    manualPricePerPortion: z.coerce.number().positive().optional().nullable(),
    calories: z.coerce.number().int().positive().optional().nullable(),
    proteinG: z.coerce.number().int().nonnegative().optional().nullable(),
    carbsG: z.coerce.number().int().nonnegative().optional().nullable(),
    fatG: z.coerce.number().int().nonnegative().optional().nullable()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const updateMenuSchema = z.object({
  body: createMenuSchema.shape.body.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: menuIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const validateMenuPriceSchema = z.object({
  body: z
    .object({
      status: z.enum(["VERIFIED", "MISMATCH"]),
      notes: z.string().trim().max(1000).optional().nullable()
    })
    .superRefine((value, ctx) => {
      if (value.status === "MISMATCH" && !value.notes?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["notes"],
          message: "notes is required when status is MISMATCH."
        });
      }
    }),
  params: menuIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

module.exports = {
  createMenuSchema,
  listMenusSchema,
  menuIdParamsSchema,
  updateMenuSchema,
  validateMenuPriceSchema
};
