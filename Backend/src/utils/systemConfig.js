const resolveNumberConfigValue = (value, defaultValue) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return Math.floor(parsedValue);
    }
  }

  if (value && typeof value === "object") {
    const candidates = [value.value, value.hours, value.maxRows];

    for (const candidate of candidates) {
      const parsedValue = Number(candidate);

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return Math.floor(parsedValue);
      }
    }
  }

  return defaultValue;
};

const getNumberSystemConfig = async (prisma, key, defaultValue) => {
  const config = await prisma.systemConfig.findUnique({
    where: {
      key
    },
    select: {
      value: true
    }
  });

  if (!config) {
    return defaultValue;
  }

  return resolveNumberConfigValue(config.value, defaultValue);
};

module.exports = {
  getNumberSystemConfig,
  resolveNumberConfigValue
};
