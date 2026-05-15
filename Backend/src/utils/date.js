const startOfDayUtc = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const endOfDayUtc = (value) => {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

module.exports = {
  endOfDayUtc,
  startOfDayUtc
};
