const priceThresholdService = require("./service");

const listPriceThresholds = async (req, res, next) => {
  try {
    const result = await priceThresholdService.listPriceThresholds({
      query: req.query
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

const generateFromFoodPrices = async (req, res, next) => {
  try {
    const result = await priceThresholdService.generateFromFoodPrices({
      actorUserId: req.user.userId
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getMyRegionThreshold = async (req, res, next) => {
  try {
    const result = await priceThresholdService.getMyRegionThreshold({
      user: req.user
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
  generateFromFoodPrices,
  getMyRegionThreshold,
  listPriceThresholds
};
