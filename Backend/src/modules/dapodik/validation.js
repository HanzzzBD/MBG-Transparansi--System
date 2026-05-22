const { z } = require("zod");

const { env } = require("../../config/env");

const educationLevelSchema = z.enum(["tk", "kb", "tpa", "sps", "pkbm", "skb", "sd", "smp", "sma", "smk", "slb"]);
const regionCodeSchema = z.coerce.string().trim().regex(/^\d{6}$/, "kode_wilayah must be a 6 digit code.");
const optionalRegionCodeSchema = z.preprocess((value) => (value === "" ? undefined : value), regionCodeSchema.optional());
const semesterIdSchema = z.coerce.string().trim().regex(/^\d{5}$/, "semester_id must be a 5 digit code.");
const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean().optional());

const regionRecapSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    id_level_wilayah: z.coerce.number().int().min(0).max(2).default(0),
    kode_wilayah: regionCodeSchema.default("000000"),
    semester_id: semesterIdSchema.default(env.DAPODIK_DEFAULT_SEMESTER_ID),
    search: z.string().trim().optional()
  })
});

const schoolProgressSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    kode_wilayah: optionalRegionCodeSchema,
    semester_id: semesterIdSchema.default(env.DAPODIK_DEFAULT_SEMESTER_ID),
    bentuk_pendidikan_id: educationLevelSchema.optional(),
    education_level: z.string().trim().optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    district: z.string().trim().optional(),
    school_status: z.string().trim().optional(),
    npsn: z.string().trim().optional(),
    search: z.string().trim().optional()
  })
});

const syncSchoolProgressSchema = z.object({
  body: z.object({
    id_level_wilayah: z.coerce.number().int().min(3).max(3).default(3),
    kode_wilayah: regionCodeSchema,
    semester_id: semesterIdSchema.default(env.DAPODIK_DEFAULT_SEMESTER_ID),
    bentuk_pendidikan_id: educationLevelSchema.default("sd")
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const listStagedSchoolsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    semester_id: semesterIdSchema.optional(),
    kode_wilayah: regionCodeSchema.optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    district: z.string().trim().optional(),
    education_level: z.string().trim().optional(),
    school_status: z.string().trim().optional(),
    npsn: z.string().trim().optional(),
    search: z.string().trim().optional(),
    autocomplete: booleanQuerySchema,
    link_status: z.enum(["linked", "unlinked"]).optional()
  })
});

const stagedSchoolIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const promoteStagedSchoolSchema = z.object({
  body: z.object({
    sppgId: z.coerce.number().int().positive(),
    address: z.string().trim().optional(),
    totalStudents: z.coerce.number().int().min(0).optional()
  }),
  params: stagedSchoolIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const linkStagedSchoolSchema = z.object({
  body: z.object({
    schoolId: z.coerce.number().int().positive(),
    syncFields: z.boolean().optional().default(true),
    address: z.string().trim().optional().nullable(),
    totalStudents: z.coerce.number().int().min(0).optional()
  }),
  params: stagedSchoolIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const importStagedSchoolsSchema = z.object({
  body: z.object({
    id_level_wilayah: z.coerce.number().int().min(3).max(3).default(3),
    kode_wilayah: optionalRegionCodeSchema,
    semester_id: semesterIdSchema.default(env.DAPODIK_DEFAULT_SEMESTER_ID),
    bentuk_pendidikan_id: educationLevelSchema.optional(),
    csv: z.string().optional(),
    items: z.array(z.record(z.string(), z.unknown())).optional()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const latestSyncLogSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    endpoint: z.string().trim().optional(),
    status: z.string().trim().optional(),
    semester_id: semesterIdSchema.optional(),
    kode_wilayah: regionCodeSchema.optional()
  })
});

module.exports = {
  importStagedSchoolsSchema,
  linkStagedSchoolSchema,
  latestSyncLogSchema,
  listStagedSchoolsSchema,
  promoteStagedSchoolSchema,
  regionRecapSchema,
  schoolProgressSchema,
  stagedSchoolIdParamsSchema,
  syncSchoolProgressSchema
};
