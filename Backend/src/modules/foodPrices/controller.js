const { importFoodPrices } = require("./importer");
const foodPriceService = require("./service");

const listFoodPrices = async (req, res, next) => {
  try {
    const result = await foodPriceService.listFoodPrices({
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

const getLatestFoodPrices = async (req, res, next) => {
  try {
    const result = await foodPriceService.getLatestFoodPrices({
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

const getEstimate = async (req, res, next) => {
  try {
    const result = await foodPriceService.calculateEstimatedPortionPrice({
      province: req.query.province
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const importFoodPriceData = async (req, res, next) => {
  try {
    const result = await importFoodPrices({
      targetPath: req.body.path,
      dryRun: req.body.dryRun,
      limit: req.body.limit,
      all: req.body.all,
      latest: req.body.latest,
      since: req.body.since,
      force: req.body.force
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEstimate,
  getLatestFoodPrices,
  importFoodPriceData,
  listFoodPrices
};
