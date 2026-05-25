const monitoringService = require("./service");

const getSummary = async (_req, res, next) => {
  try {
    const result = await monitoringService.getMonitoringSummary();

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const listApis = async (_req, res, next) => {
  try {
    const result = await monitoringService.listApiItems();

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const listErrors = async (_req, res, next) => {
  try {
    const result = await monitoringService.listErrors();

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const listSyncSources = async (_req, res, next) => {
  try {
    const result = await monitoringService.listSyncSources();

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const testApi = async (req, res, next) => {
  try {
    const result = await monitoringService.testApiItem({
      id: req.params.id
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const syncSource = async (req, res, next) => {
  try {
    const result = await monitoringService.syncSource({
      id: req.params.id
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  listApis,
  listErrors,
  listSyncSources,
  syncSource,
  testApi
};
