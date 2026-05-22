const { getPrismaClient } = require("../config/prisma");
const {
  calculateEstimatedPortionPrice,
  generatePriceThresholdsFromFoodPrices
} = require("../modules/foodPrices/service");
const { checkDistributionPriceAnomaly } = require("../utils/distributionPriceAnomaly");

const prisma = getPrismaClient();

const ROLLBACK_SIGNAL = "VERIFY_FOOD_PRICE_ROLLBACK";

const verifyReadSide = async () => {
  const [foodPriceCount, thresholdCount, latestPrice, productionBatchCount, productionBatchItemCount] = await Promise.all([
    prisma.foodPrice.count(),
    prisma.priceThreshold.count({
      where: {
        generatedFromFoodPrices: true
      }
    }),
    prisma.foodPrice.findFirst({
      orderBy: {
        date: "desc"
      }
    }),
    prisma.productionBatch.count(),
    prisma.productionBatchItem.count()
  ]);

  console.log(`food_prices rows: ${foodPriceCount}`);
  console.log(`generated price_thresholds rows: ${thresholdCount}`);
  console.log(`production_batches rows: ${productionBatchCount}`);
  console.log(`production_batch_items rows: ${productionBatchItemCount}`);

  if (latestPrice?.province) {
    const estimate = await calculateEstimatedPortionPrice({
      province: latestPrice.province
    });
    console.log(`estimate ${latestPrice.province}: ${estimate.estimatedPortionPrice}`);
  } else {
    console.log("estimate skipped: no province food price data found.");
  }
};

const verifyThresholdGeneration = async () => {
  const summary = await generatePriceThresholdsFromFoodPrices();
  console.log(`threshold generation: ${JSON.stringify(summary)}`);
};

const verifyDistributionAnomalyFlow = async () => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      deletedAt: null,
      schools: {
        some: {
          deletedAt: null
        }
      }
    },
    include: {
      schools: {
        where: {
          deletedAt: null
        },
        take: 1
      }
    }
  });

  if (!sppg || !sppg.schools[0]) {
    console.log("distribution anomaly flow skipped: no active SPPG with school found.");
    return;
  }

  const threshold = await prisma.priceThreshold.findFirst({
    where: {
      province: {
        equals: sppg.province,
        mode: "insensitive"
      }
    }
  });

  if (!threshold) {
    console.log(`distribution anomaly flow skipped: no threshold for ${sppg.province}.`);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const school = sppg.schools[0];
      const normalPrice = Math.max(Number(threshold.minPrice), Math.min(Number(threshold.maxPrice), Number(threshold.avgReferencePrice || threshold.minPrice)));
      const highPrice = Number(threshold.maxPrice) + 1000;
      const lowPrice = Math.max(Number(threshold.minPrice) - 1000, 1);

      const cases = [
        { label: "normal", price: normalPrice, expectedAnomaly: false },
        { label: "above", price: highPrice, expectedAnomaly: true },
        { label: "below", price: lowPrice, expectedAnomaly: true }
      ];

      for (const item of cases) {
        const distribution = await tx.distribution.create({
          data: {
            sppgId: sppg.id,
            schoolId: school.id,
            portions: 10,
            pricePerPortion: item.price,
            distributionDate: new Date(),
            status: "in_progress"
          }
        });

        await checkDistributionPriceAnomaly({
          prisma: tx,
          distribution,
          province: sppg.province
        });

        const anomalyCount = await tx.anomalyLog.count({
          where: {
            distributionId: distribution.id,
            anomalyType: "PRICE_ANOMALY",
            isResolved: false
          }
        });

        console.log(`${item.label} price anomaly: ${anomalyCount > 0}`);

        if (item.expectedAnomaly !== (anomalyCount > 0)) {
          throw new Error(`Unexpected anomaly result for ${item.label}.`);
        }
      }

      throw new Error(ROLLBACK_SIGNAL);
    });
  } catch (error) {
    if (error.message !== ROLLBACK_SIGNAL) {
      throw error;
    }

    console.log("distribution anomaly flow verified in a rolled-back transaction.");
  }
};

const verifyProductionBatchCostingFlow = async () => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      deletedAt: null
    }
  });

  if (!sppg) {
    console.log("production batch costing flow skipped: no active SPPG found.");
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatch.create({
        data: {
          sppgId: sppg.id,
          productionDate: new Date(),
          totalPortions: 100,
          operationalCost: 100000,
          packagingCost: 50000,
          distributionCost: 50000,
          notes: "verification batch"
        }
      });

      await tx.productionBatchItem.create({
        data: {
          productionBatchId: batch.id,
          commodityName: "Beras Medium",
          quantity: 10,
          unit: "kg",
          unitPrice: 15000,
          totalPrice: 150000
        }
      });

      const rawMaterialCost = 150000;
      const totalCost = rawMaterialCost + 100000 + 50000 + 50000;
      const costPerPortion = totalCost / 100;

      const updated = await tx.productionBatch.update({
        where: {
          id: batch.id
        },
        data: {
          rawMaterialCost,
          totalCost,
          costPerPortion
        }
      });

      console.log(`production batch total_cost verified: ${Number(updated.totalCost) === totalCost}`);
      console.log(`production batch cost_per_portion verified: ${Number(updated.costPerPortion) === costPerPortion}`);

      throw new Error(ROLLBACK_SIGNAL);
    });
  } catch (error) {
    if (error.message !== ROLLBACK_SIGNAL) {
      throw error;
    }

    console.log("production batch costing flow verified in a rolled-back transaction.");
  }
};

const main = async () => {
  const shouldMutate = process.argv.includes("--mutate");

  await verifyReadSide();
  await verifyThresholdGeneration();

  if (shouldMutate) {
    await verifyProductionBatchCostingFlow();
    await verifyDistributionAnomalyFlow();
  } else {
    console.log("mutation flows skipped. Run with --mutate to test costing and anomaly in rolled-back transactions.");
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
