const { z } = require("zod");

const auditActionEnum = z.enum(["INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "LOCK", "UNLOCK"]);
const anomalyTypeEnum = z.enum([
  "OVER_CAPACITY",
  "PRICE_ANOMALY",
  "VALIDATION_CONFLICT",
  "PENDING_TIMEOUT"
]);
const distributionStatusEnum = z.enum(["in_progress", "delivered", "failed"]);
const updatableUserRoleEnum = z.enum(["admin", "pemerintah", "sppg", "sekolah", "umum"]);
const creatableUserRoleEnum = z.enum(["pemerintah", "sppg", "sekolah"]);

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

const listUsersSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: z.string().trim().optional(),
    role: updatableUserRoleEnum.optional(),
    isActive: booleanQuerySchema.optional()
  })
});

const adminUserIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, "Name is required.").max(255, "Name is too long."),
      email: z.email("A valid email address is required.").transform((value) => value.trim().toLowerCase()),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters long.")
        .max(72, "Password must not exceed 72 characters."),
      role: creatableUserRoleEnum,
      sppgId: z.coerce.number().int().positive().optional(),
      schoolId: z.coerce.number().int().positive().optional()
    })
    .superRefine((value, ctx) => {
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

const updateUserSchema = z.object({
  body: z
    .object({
      role: updatableUserRoleEnum.optional(),
      isActive: z.boolean().optional(),
      sppgId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
      schoolId: z.union([z.coerce.number().int().positive(), z.null()]).optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field must be provided."
    }),
  params: adminUserIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const listAuditLogsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    table_name: z.string().trim().min(1).optional(),
    user_id: z.coerce.number().int().positive().optional(),
    action: auditActionEnum.optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional()
  })
});

const listAnomalyLogsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    is_resolved: booleanQuerySchema.optional(),
    anomaly_type: anomalyTypeEnum.optional()
  })
});

const anomalyLogIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const distributionLockParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const overrideDistributionSchema = z.object({
  body: z
    .object({
      sppgId: z.coerce.number().int().positive().optional(),
      schoolId: z.coerce.number().int().positive().optional(),
      portions: z.coerce.number().int().positive().optional(),
      pricePerPortion: z.coerce.number().positive().optional(),
      distributionDate: z.iso.date().optional(),
      status: distributionStatusEnum.optional(),
      failureReason: z.string().trim().max(1000).optional().nullable(),
      overrideReason: z.string().trim().min(1).max(500).optional()
    })
    .refine(
      (value) =>
        Object.keys(value).some((key) =>
          ["sppgId", "schoolId", "portions", "pricePerPortion", "distributionDate", "status", "failureReason"].includes(
            key
          )
        ),
      {
        message: "At least one distribution field must be provided."
      }
    ),
  params: distributionLockParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const listPriceThresholdsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    province: z.string().trim().optional()
  })
});

const updatePriceThresholdSchema = z.object({
  body: z
    .object({
      minPrice: z.coerce.number().positive(),
      maxPrice: z.coerce.number().positive()
    })
    .refine((value) => value.maxPrice > value.minPrice, {
      message: "maxPrice must be greater than minPrice.",
      path: ["maxPrice"]
    }),
  params: z.object({
    province: z.string().trim().min(1).max(255)
  }),
  query: z.object({}).optional().default({})
});

const listSystemConfigsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: z.string().trim().optional()
  })
});

const updateSystemConfigSchema = z.object({
  body: z.object({
    value: z.unknown(),
    description: z.string().trim().max(500).optional().nullable()
  }),
  params: z.object({
    key: z.string().trim().min(1).max(120)
  }),
  query: z.object({}).optional().default({})
});

module.exports = {
  adminUserIdParamsSchema,
  anomalyLogIdParamsSchema,
  createUserSchema,
  distributionLockParamsSchema,
  listAnomalyLogsSchema,
  listAuditLogsSchema,
  listPriceThresholdsSchema,
  listSystemConfigsSchema,
  listUsersSchema,
  overrideDistributionSchema,
  updatePriceThresholdSchema,
  updateSystemConfigSchema,
  updateUserSchema
};
