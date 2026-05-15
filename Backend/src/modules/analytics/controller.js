const analyticsService = require("./service");

const getSummary = async (req, res, next) => {
  try {
    const result = await analyticsService.getSummary({
      filters: req.query
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const getDistributionTrend = async (req, res, next) => {
  try {
    const result = await analyticsService.getDistributionTrend({
      filters: req.query,
      granularity: req.query.granularity
    });

    res.status(200).json({
      status: "success",
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

const getSuccessRate = async (req, res, next) => {
  try {
    const result = await analyticsService.getSuccessRate({
      filters: req.query,
      granularity: req.query.granularity
    });

    res.status(200).json({
      status: "success",
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

const getBudget = async (req, res, next) => {
  try {
    const result = await analyticsService.getBudget({
      filters: req.query
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const getByProvince = async (req, res, next) => {
  try {
    const result = await analyticsService.getByProvince({
      filters: req.query,
      limit: req.query.limit
    });

    res.status(200).json({
      status: "success",
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

const getAnomaly = async (req, res, next) => {
  try {
    const pagination = analyticsService.parseAnalyticsPagination(req.query);
    const result = await analyticsService.getAnomaly({
      filters: req.query,
      pagination
    });

    res.status(200).json({
      status: "success",
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnomaly,
  getBudget,
  getByProvince,
  getDistributionTrend,
  getSuccessRate,
  getSummary
};
