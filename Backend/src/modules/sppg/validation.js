const { z } = require("zod");

const sppgStatusEnum = z.enum(["active", "inactive", "problem"]);
const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

const listSppgSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    search: z.string().trim().optional(),
    status: sppgStatusEnum.optional(),
    fields: z.string().trim().optional(),
    all: booleanQuerySchema.optional()
  })
});

const mapMarkersSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    search: z.string().trim().optional(),
    status: sppgStatusEnum.optional()
  })
});

const listMySchoolsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    status: z.enum(["active", "inactive", "all"]).optional()
  })
});

const listMyDapodikSchoolsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    district: z.string().trim().optional(),
    educationLevel: z.string().trim().optional(),
    education_level: z.string().trim().optional()
  })
});

const assignMySchoolsSchema = z.object({
  body: z
    .object({
      dapodikSchoolId: z.coerce.number().int().positive().optional(),
      dapodikSchoolIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
      notes: z.string().trim().max(1000).optional().nullable()
    })
    .refine((value) => value.dapodikSchoolId || (Array.isArray(value.dapodikSchoolIds) && value.dapodikSchoolIds.length > 0), {
      message: "dapodikSchoolId or dapodikSchoolIds is required."
    }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const unassignMySchoolSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(1000).optional().nullable()
  }).optional().default({}),
  params: z.object({
    assignmentId: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const adminSppgSchoolsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: listMySchoolsSchema.shape.query
});

const adminAssignSppgSchoolsSchema = z.object({
  body: assignMySchoolsSchema.shape.body,
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const adminUnassignSppgSchoolSchema = z.object({
  body: unassignMySchoolSchema.shape.body,
  params: z.object({
    id: z.coerce.number().int().positive(),
    assignmentId: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const listDeletedSppgSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    search: z.string().trim().optional(),
    status: sppgStatusEnum.optional()
  })
});

const sppgIdParamsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional().default({})
});

const createSppgSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(255),
    province: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(255),
    address: z.string().trim().max(500).optional().nullable(),
    lat: z.coerce.number().optional().nullable(),
    lng: z.coerce.number().optional().nullable(),
    capacity: z.coerce.number().int().positive(),
    workers: z.coerce.number().int().nonnegative().optional().nullable(),
    picName: z.string().trim().max(255).optional().nullable(),
    picPhone: z.string().trim().max(50).optional().nullable(),
    status: sppgStatusEnum.optional()
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const updateSppgSchema = z.object({
  body: createSppgSchema.shape.body.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  }),
  params: sppgIdParamsSchema.shape.params,
  query: z.object({}).optional().default({})
});

const updateMySppgProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(255).optional(),
      address: z.string().trim().max(500).optional().nullable(),
      workers: z.coerce.number().int().nonnegative().optional().nullable(),
      picName: z.string().trim().max(255).optional().nullable(),
      picPhone: z.string().trim().max(50).optional().nullable()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field must be provided."
    }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

module.exports = {
  createSppgSchema,
  adminAssignSppgSchoolsSchema,
  adminSppgSchoolsSchema,
  adminUnassignSppgSchoolSchema,
  assignMySchoolsSchema,
  listDeletedSppgSchema,
  listMyDapodikSchoolsSchema,
  listMySchoolsSchema,
  listSppgSchema,
  mapMarkersSchema,
  sppgIdParamsSchema,
  unassignMySchoolSchema,
  updateMySppgProfileSchema,
  updateSppgSchema
};
