const { ensurePriceThresholdForProvince } = require("../modules/foodPrices/service");
const { createAnomalyIfNeeded } = require("./anomaly");

const formatRupiah = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString("id-ID")}`;

const resolveOpenPriceAnomaly = async ({ prisma, distributionId, actorUserId = null }) =>
  prisma.anomalyLog.updateMany({
    where: {
      distributionId,
      anomalyType: "PRICE_ANOMALY",
      isResolved: false
    },
    data: {
      isResolved: true,
      resolvedBy: actorUserId,
      resolvedAt: new Date()
    }
  });

const checkDistributionPriceAnomaly = async ({
  prisma,
  distribution,
  province,
  actorUserId = null,
  ipAddress = null
}) => {
  const priceThreshold = await ensurePriceThresholdForProvince({
    province,
    client: prisma,
    actorUserId
  });

  if (!priceThreshold) {
    return {
      checked: false,
      warning: `Price threshold is not available for ${province || "unknown province"}.`
    };
  }

  const pricePerPortion = Number(distribution.pricePerPortion);
  const minPrice = Number(priceThreshold.minPrice);
  const maxPrice = Number(priceThreshold.maxPrice);

  if (pricePerPortion > maxPrice) {
    return createAnomalyIfNeeded({
      prisma,
      distributionId: distribution.id,
      anomalyType: "PRICE_ANOMALY",
      description: `Harga porsi ${formatRupiah(pricePerPortion)} melebihi batas maksimum wilayah ${province} ${formatRupiah(maxPrice)}.`,
      actorUserId,
      ipAddress
    });
  }

  if (pricePerPortion < minPrice) {
    return createAnomalyIfNeeded({
      prisma,
      distributionId: distribution.id,
      anomalyType: "PRICE_ANOMALY",
      description: `Harga porsi ${formatRupiah(pricePerPortion)} di bawah batas minimum wilayah ${province} ${formatRupiah(minPrice)}.`,
      actorUserId,
      ipAddress
    });
  }

  // Jika distribusi diedit kembali ke rentang wajar, anomali harga terbuka ikut ditutup
  // agar dashboard pemerintah/admin mencerminkan kondisi data terbaru.
  await resolveOpenPriceAnomaly({
    prisma,
    distributionId: distribution.id,
    actorUserId
  });

  return {
    checked: true,
    created: false
  };
};

module.exports = {
  checkDistributionPriceAnomaly
};
