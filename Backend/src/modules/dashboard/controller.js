const dashboardService = require("./service");

const sendSummary = (res, data) => {
  res.status(200).json({
    status: "success",
    data
  });
};

const getAdminSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getAdminSummary({
      filters: req.query,
      user: req.user
    });

    sendSummary(res, data);
  } catch (error) {
    next(error);
  }
};

const getGovSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getGovSummary({
      filters: req.query,
      user: req.user
    });

    sendSummary(res, data);
  } catch (error) {
    next(error);
  }
};

const getSppgSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getSppgSummary({
      user: req.user
    });

    sendSummary(res, data);
  } catch (error) {
    next(error);
  }
};

const getSchoolSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getSchoolSummary({
      user: req.user
    });

    sendSummary(res, data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminSummary,
  getGovSummary,
  getSchoolSummary,
  getSppgSummary
};
