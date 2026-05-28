const distributionService = require("./service");
const adminService = require("../admin/service");
const { getClientIp } = require("../../utils/request");

const listDistributions = async (req, res, next) => {
  try {
    const result = await distributionService.listDistributions({
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

const getDistributionDetail = async (req, res, next) => {
  try {
    const result = await distributionService.getDistributionDetail({
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

const getLockSummary = async (_req, res, next) => {
  try {
    const result = await distributionService.getLockSummary();

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const createDistribution = async (req, res, next) => {
  try {
    const result = await distributionService.createDistribution({
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

const updateDistribution = async (req, res, next) => {
  try {
    const result = await distributionService.updateDistribution({
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

const markDistributionSent = async (req, res, next) => {
  try {
    const result = await distributionService.markDistributionSent({
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

const lockDistribution = async (req, res, next) => {
  try {
    const result = await adminService.lockDistribution({
      id: req.params.id,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req),
      reason: req.body.reason
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const unlockDistribution = async (req, res, next) => {
  try {
    const result = await adminService.unlockDistribution({
      id: req.params.id,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req),
      reason: req.body.reason,
      autoRelockAfterOneHour: req.body.autoRelockAfterOneHour !== false
    });

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const overrideDistribution = async (req, res, next) => {
  try {
    const result = await adminService.overrideDistribution({
      id: req.params.id,
      payload: {
        ...(req.body.changes || {}),
        overrideReason: req.body.reason
      },
      actorUserId: req.user.userId,
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

module.exports = {
  createDistribution,
  getDistributionDetail,
  getLockSummary,
  listDistributions,
  lockDistribution,
  markDistributionSent,
  overrideDistribution,
  unlockDistribution,
  updateDistribution
};
