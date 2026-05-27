const cleanRegionText = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return normalized || null;
};

const stripPrefix = (value, prefixes) => {
  let result = value;
  for (const prefix of prefixes) {
    result = result.replace(new RegExp(`^${prefix}\\s+`, "i"), "");
  }
  return result.replace(/\s+/g, " ").trim();
};

const normalizeProvinceName = (value) => {
  const text = cleanRegionText(value);
  if (!text) return null;
  return stripPrefix(text, ["PROV", "PROVINSI"]);
};

const normalizeCityName = (value) => {
  const text = cleanRegionText(value);
  if (!text) return null;
  return text.replace(/^KAB\s+/, "KABUPATEN ");
};

const normalizeDistrictName = (value) => {
  const text = cleanRegionText(value);
  if (!text) return null;
  return stripPrefix(text, ["KEC", "KECAMATAN"]);
};

module.exports = {
  cleanRegionText,
  normalizeCityName,
  normalizeDistrictName,
  normalizeProvinceName
};
