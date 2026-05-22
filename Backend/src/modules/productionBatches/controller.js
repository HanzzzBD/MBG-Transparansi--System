const productionBatchService = require("./service");
const { getClientIp } = require("../../utils/request");

const listProductionBatches = async (req, res, next) => {
  try {
    const result = await productionBatchService.listProductionBatches({
      query: req.query,
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

const getProductionBatchDetail = async (req, res, next) => {
  try {
    const result = await productionBatchService.getProductionBatchDetail({
      id: req.params.id,
      user: req.user
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const createProductionBatch = async (req, res, next) => {
  try {
    const result = await productionBatchService.createProductionBatch({
      payload: req.body,
      user: req.user,
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const updateProductionBatch = async (req, res, next) => {
  try {
    const result = await productionBatchService.updateProductionBatch({
      id: req.params.id,
      payload: req.body,
      user: req.user,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const deleteProductionBatch = async (req, res, next) => {
  try {
    const result = await productionBatchService.deleteProductionBatch({
      id: req.params.id,
      user: req.user,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const addProductionBatchItem = async (req, res, next) => {
  try {
    const result = await productionBatchService.addProductionBatchItem({
      batchId: req.params.id,
      payload: req.body,
      user: req.user,
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const updateProductionBatchItem = async (req, res, next) => {
  try {
    const result = await productionBatchService.updateProductionBatchItem({
      id: req.params.id,
      payload: req.body,
      user: req.user,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const deleteProductionBatchItem = async (req, res, next) => {
  try {
    const result = await productionBatchService.deleteProductionBatchItem({
      id: req.params.id,
      user: req.user,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const getCostSummary = async (req, res, next) => {
  try {
    const result = await productionBatchService.getCostSummary({
      id: req.params.id,
      user: req.user
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const getBatchAnomalies = async (req, res, next) => {
  try {
    const result = await productionBatchService.getBatchAnomalies({
      id: req.params.id,
      user: req.user
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
  addProductionBatchItem,
  createProductionBatch,
  deleteProductionBatch,
  deleteProductionBatchItem,
  getBatchAnomalies,
  getCostSummary,
  getProductionBatchDetail,
  listProductionBatches,
  updateProductionBatch,
  updateProductionBatchItem
};
