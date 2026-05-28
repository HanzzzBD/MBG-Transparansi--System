const { normalizeCityName, normalizeProvinceName } = require("../../utils/region");

const toDateOnly = (value) => {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
};

const toNumber = (value) => Number(value) || 0;
const PUBLIC_SPPG_STATUSES = new Set(["active", "inactive", "problem"]);
const normalizePublicSppgStatus = (status) => (PUBLIC_SPPG_STATUSES.has(status) ? status : "active");

const toNullableNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const serializePublicMenu = (menu) => {
  if (!menu) return null;

  return {
    name: menu.menuName,
    nutrition: {
      calories: toNumber(menu.calories),
      protein: toNumber(menu.proteinG),
      carbohydrate: toNumber(menu.carbsG),
      fat: toNumber(menu.fatG)
    }
  };
};

const serializePublicDistribution = (distribution) => ({
  schoolName: distribution.school?.name || "-",
  portions: toNumber(distribution.portions),
  status: distribution.status,
  deliveryStatus: distribution.status,
  confirmationStatus: distribution.validation?.status || "pending",
  date: toDateOnly(distribution.distributionDate)
});

const serializePublicSppgMarker = ({ sppg, district = null }) => ({
  id: String(sppg.id),
  name: sppg.name,
  province: normalizeProvinceName(sppg.province) || sppg.province,
  city: normalizeCityName(sppg.city) || sppg.city,
  district,
  status: normalizePublicSppgStatus(sppg.status),
  lat: toNullableNumber(sppg.lat),
  lng: toNullableNumber(sppg.lng),
  capacity: toNumber(sppg.capacity)
});

const serializePublicSppgDetail = ({
  sppg,
  district = null,
  todayPortions = 0,
  successRate = 0,
  todayMenu = null,
  recentDistributions = []
}) => {
  const { lat: _lat, lng: _lng, ...publicFields } = serializePublicSppgMarker({ sppg, district });

  return {
    ...publicFields,
    todayPortions: toNumber(todayPortions),
    successRate: toNumber(successRate),
    todayMenu: serializePublicMenu(todayMenu),
    recentDistributions: recentDistributions.map(serializePublicDistribution)
  };
};

module.exports = {
  serializePublicSppgDetail,
  serializePublicSppgMarker
};
