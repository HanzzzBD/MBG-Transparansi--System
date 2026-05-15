const { z } = require("zod");

const creatableRoles = ["sppg", "sekolah", "pemerintah"];

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name is required.").max(255, "Name is too long."),
    email: z.email("A valid email address is required.").transform((value) => value.trim().toLowerCase()),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .max(72, "Password must not exceed 72 characters."),
    role: z.enum(creatableRoles),
    sppgId: z.coerce.number().int().positive().optional(),
    schoolId: z.coerce.number().int().positive().optional()
  }).superRefine((value, ctx) => {
    if (value.role === "sppg" && !value.sppgId) {
      ctx.addIssue({
        code: "custom",
        path: ["sppgId"],
        message: "sppgId is required for sppg accounts."
      });
    }

    if (value.role === "sekolah" && !value.schoolId) {
      ctx.addIssue({
        code: "custom",
        path: ["schoolId"],
        message: "schoolId is required for sekolah accounts."
      });
    }

    if (value.role !== "sppg" && value.sppgId) {
      ctx.addIssue({
        code: "custom",
        path: ["sppgId"],
        message: "sppgId can only be set for sppg accounts."
      });
    }

    if (value.role !== "sekolah" && value.schoolId) {
      ctx.addIssue({
        code: "custom",
        path: ["schoolId"],
        message: "schoolId can only be set for sekolah accounts."
      });
    }
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const loginSchema = z.object({
  body: z.object({
    email: z.email("A valid email address is required.").transform((value) => value.trim().toLowerCase()),
    password: z.string().min(1, "Password is required.")
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  creatableRoles,
  loginSchema,
  registerSchema
};
