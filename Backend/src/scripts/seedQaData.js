const bcrypt = require("bcrypt");

const { getPrismaClient } = require("../config/prisma");
const { seedPermissions, seedSystemConfigs } = require("../../prisma/seed");

const prisma = getPrismaClient();

const QA_PASSWORD = process.env.QA_SEED_PASSWORD || "QaPass123!";
const QA_SPPG_NAME = "QA SPPG Pre Deployment";
const QA_SCHOOL_NPSN = "QA-MBG-001";

const startOfToday = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const upsertUser = async ({ name, email, role, sppgId = null, schoolId = null }) => {
  const password = await bcrypt.hash(QA_PASSWORD, 12);

  return prisma.user.upsert({
    where: {
      email
    },
    update: {
      name,
      password,
      role,
      sppgId,
      schoolId,
      isActive: true,
      deletedAt: null
    },
    create: {
      name,
      email,
      password,
      role,
      sppgId,
      schoolId,
      isActive: true
    }
  });
};

const run = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("QA seed is disabled in production.");
  }

  await seedSystemConfigs();
  await seedPermissions();

  const productionDate = startOfToday();

  const sppg =
    (await prisma.sppg.findFirst({
      where: {
        name: QA_SPPG_NAME
      }
    })) ||
    (await prisma.sppg.create({
      data: {
        name: QA_SPPG_NAME,
        province: "DKI Jakarta",
        city: "Jakarta Pusat",
        address: "Jl. QA Pre Deployment No. 1",
        lat: -6.1754,
        lng: 106.8272,
        capacity: 1500,
        workers: 24,
        picName: "Koordinator QA",
        picPhone: "081200000001",
        status: "active"
      }
    }));

  await prisma.sppg.update({
    where: {
      id: sppg.id
    },
    data: {
      status: "active",
      deletedAt: null,
      lat: -6.1754,
      lng: 106.8272
    }
  });

  const school = await prisma.school.upsert({
    where: {
      npsn: QA_SCHOOL_NPSN
    },
    update: {
      name: "QA SD Validasi MBG",
      sppgId: sppg.id,
      province: "DKI Jakarta",
      city: "Jakarta Pusat",
      district: "Gambir",
      totalStudents: 480,
      deletedAt: null
    },
    create: {
      name: "QA SD Validasi MBG",
      npsn: QA_SCHOOL_NPSN,
      sppgId: sppg.id,
      province: "DKI Jakarta",
      city: "Jakarta Pusat",
      district: "Gambir",
      address: "Jl. Sekolah QA No. 2",
      totalStudents: 480,
      educationLevel: "SD",
      schoolStatus: "NEGERI"
    }
  });

  const [adminUser, govUser, sppgUser, schoolUser] = await Promise.all([
    upsertUser({ name: "QA Admin", email: "qa.admin@mbg.local", role: "admin" }),
    upsertUser({ name: "QA Pemerintah", email: "qa.gov@mbg.local", role: "pemerintah" }),
    upsertUser({ name: "QA SPPG", email: "qa.sppg@mbg.local", role: "sppg", sppgId: sppg.id }),
    upsertUser({ name: "QA Sekolah", email: "qa.sekolah@mbg.local", role: "sekolah", schoolId: school.id })
  ]);

  const assignment = await prisma.sppgSchoolAssignment.findFirst({
    where: {
      sppgId: sppg.id,
      schoolId: school.id
    }
  });

  if (assignment) {
    await prisma.sppgSchoolAssignment.update({
      where: {
        id: assignment.id
      },
      data: {
        status: "active",
        unassignedAt: null,
        assignedBy: adminUser.id,
        notes: "QA pre-deployment active assignment"
      }
    });
  } else {
    await prisma.sppgSchoolAssignment.create({
      data: {
        sppgId: sppg.id,
        schoolId: school.id,
        assignedBy: adminUser.id,
        status: "active",
        notes: "QA pre-deployment active assignment"
      }
    });
  }

  const menu = await prisma.menu.upsert({
    where: {
      sppgId_menuDate: {
        sppgId: sppg.id,
        menuDate: productionDate
      }
    },
    update: {
      menuName: "Menu QA Lengkap",
      items: {
        karbohidrat: "Nasi",
        protein: "Telur dan ayam",
        sayur: "Tumis wortel"
      },
      manualPricePerPortion: 13500,
      priceValidationStatus: "VERIFIED",
      priceValidationNotes: "QA seed verified menu",
      priceValidatedAt: new Date(),
      priceValidatedBy: adminUser.id,
      deletedAt: null
    },
    create: {
      sppgId: sppg.id,
      menuDate: productionDate,
      menuName: "Menu QA Lengkap",
      items: {
        karbohidrat: "Nasi",
        protein: "Telur dan ayam",
        sayur: "Tumis wortel"
      },
      manualPricePerPortion: 13500,
      priceValidationStatus: "VERIFIED",
      priceValidationNotes: "QA seed verified menu",
      priceValidatedAt: new Date(),
      priceValidatedBy: adminUser.id
    }
  });

  const batch =
    (await prisma.productionBatch.findFirst({
      where: {
        sppgId: sppg.id,
        productionDate,
        notes: {
          contains: "QA seed"
        }
      }
    })) ||
    (await prisma.productionBatch.create({
      data: {
        sppgId: sppg.id,
        menuId: menu.id,
        productionDate,
        totalPortions: 100,
        operationalCost: 250000,
        packagingCost: 100000,
        distributionCost: 75000,
        rentCost: 150000,
        notes: "QA seed production batch with rentCost and raw material items"
      }
    }));

  await prisma.productionBatch.update({
    where: {
      id: batch.id
    },
    data: {
      menuId: menu.id,
      totalPortions: 100,
      operationalCost: 250000,
      packagingCost: 100000,
      distributionCost: 75000,
      rentCost: 150000,
      notes: "QA seed production batch with rentCost and raw material items"
    }
  });

  await prisma.anomalyLog.deleteMany({
    where: {
      productionBatchId: batch.id
    }
  });
  await prisma.productionBatchItem.deleteMany({
    where: {
      productionBatchId: batch.id
    }
  });

  const foodPriceDate = productionDate;
  const berasReference = await prisma.foodPrice.upsert({
    where: {
      date_scope_provinceCode_cityCode_variantId: {
        date: foodPriceDate,
        scope: "province",
        provinceCode: "31",
        cityCode: "",
        variantId: 101
      }
    },
    update: {
      province: "DKI Jakarta",
      variant: "Beras Medium",
      unit: "kg",
      price: 12000,
      source: "QA SP2KP",
      sourceEndpoint: "qa-seed"
    },
    create: {
      date: foodPriceDate,
      source: "QA SP2KP",
      scope: "province",
      level: "province",
      provinceCode: "31",
      province: "DKI Jakarta",
      cityCode: "",
      city: "",
      variantId: 101,
      variant: "Beras Medium",
      unit: "kg",
      quantity: 1,
      price: 12000,
      sourceEndpoint: "qa-seed"
    }
  });

  const berasItem = await prisma.productionBatchItem.create({
    data: {
      productionBatchId: batch.id,
      commodityName: "Beras Medium",
      variantId: 101,
      quantity: 30,
      unit: "kg",
      unitPrice: 18000,
      totalPrice: 540000,
      sourcePrice: berasReference.source,
      sourcePriceId: berasReference.id,
      marketReferencePrice: 12000,
      priceDifferencePercent: 50
    }
  });

  await prisma.productionBatchItem.create({
    data: {
      productionBatchId: batch.id,
      commodityName: "Telur Ayam",
      variantId: 102,
      quantity: 20,
      unit: "kg",
      unitPrice: 23000,
      totalPrice: 460000,
      sourcePrice: "QA SP2KP",
      marketReferencePrice: 23000,
      priceDifferencePercent: 0
    }
  });

  await prisma.productionBatch.update({
    where: {
      id: batch.id
    },
    data: {
      rawMaterialCost: 1000000,
      totalCost: 1575000,
      costPerPortion: 15750
    }
  });

  await prisma.anomalyLog.create({
    data: {
      productionBatchId: batch.id,
      productionBatchItemId: berasItem.id,
      anomalyType: "RAW_MATERIAL_PRICE_ANOMALY",
      description: "QA seed: harga Beras Medium lebih tinggi 50% dari referensi pasar.",
      metadata: {
        commodity_name: "Beras Medium",
        market_price: 12000,
        input_price: 18000,
        selisih_percent: 50,
        province: "DKI Jakarta",
        production_batch_id: batch.id
      },
      isResolved: false
    }
  });

  const distribution =
    (await prisma.distribution.findFirst({
      where: {
        sppgId: sppg.id,
        schoolId: school.id,
        distributionDate: productionDate
      }
    })) ||
    (await prisma.distribution.create({
      data: {
        sppgId: sppg.id,
        schoolId: school.id,
        menuId: menu.id,
        productionBatchId: batch.id,
        portions: 100,
        pricePerPortion: 13500,
        distributionDate: productionDate,
        status: "delivered",
        sentAt: new Date()
      }
    }));

  await prisma.distribution.update({
    where: {
      id: distribution.id
    },
    data: {
      menuId: menu.id,
      productionBatchId: batch.id,
      portions: 100,
      pricePerPortion: 13500,
      status: "delivered",
      sentAt: new Date()
    }
  });

  await prisma.validation.upsert({
    where: {
      distributionId: distribution.id
    },
    update: {
      schoolId: school.id,
      receivedPortions: 100,
      qualityOk: true,
      status: "verified",
      notes: "QA seed validation sample",
      validatedAt: new Date()
    },
    create: {
      distributionId: distribution.id,
      schoolId: school.id,
      receivedPortions: 100,
      qualityOk: true,
      status: "verified",
      notes: "QA seed validation sample",
      validatedAt: new Date()
    }
  });

  const existingPublicReport = await prisma.publicReport.findFirst({
    where: {
      message: {
        contains: "QA seed laporan masyarakat"
      }
    }
  });

  const publicReport =
    existingPublicReport ||
    (await prisma.publicReport.create({
      data: {
        reporterName: "Warga QA",
        category: "kualitas_makanan",
        message: "QA seed laporan masyarakat untuk validasi dashboard pre-deployment.",
        province: "DKI Jakarta",
        city: "Jakarta Pusat",
        status: "baru"
      }
    }));

  console.log(
    JSON.stringify(
      {
        status: "success",
        qaPassword: QA_PASSWORD,
        users: [adminUser.email, govUser.email, sppgUser.email, schoolUser.email],
        sppgId: sppg.id,
        schoolId: school.id,
        productionBatchId: batch.id,
        rawMaterialAnomaly: "unresolved",
        distributionId: distribution.id,
        publicReportId: publicReport.id
      },
      null,
      2
    )
  );
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("QA seed gagal:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  run
};
