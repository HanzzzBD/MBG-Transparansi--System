const adminService = require("./service");
const { getClientIp } = require("../../utils/request");

const listUsers = async (req, res, next) => {
  try {
    const result = await adminService.listUsers({
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

const listRoles = async (_req, res, next) => {
  try {
    const result = await adminService.listRoles();

    res.status(200).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const result = await adminService.createUser({
      payload: req.body,
      actorUserId: req.user.userId,
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

const updateUser = async (req, res, next) => {
  try {
    const result = await adminService.updateUser({
      id: req.params.id,
      payload: req.body,
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

const updateUserStatus = async (req, res, next) => {
  try {
    const result = await adminService.updateUser({
      id: req.params.id,
      payload: {
        isActive: req.body.isActive
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

const deleteUser = async (req, res, next) => {
  try {
    const result = await adminService.deleteUser({
      id: req.params.id,
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

const listAuditLogs = async (req, res, next) => {
  try {
    const result = await adminService.listAuditLogs({
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

const listAnomalyLogs = async (req, res, next) => {
  try {
    const result = await adminService.listAnomalyLogs({
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

const resolveAnomalyLog = async (req, res, next) => {
  try {
    const result = await adminService.resolveAnomalyLog({
      id: req.params.id,
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
      autoRelockAfterOneHour: req.body.autoRelockAfterOneHour
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
      payload: req.body,
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

const listPriceThresholds = async (req, res, next) => {
  try {
    const result = await adminService.listPriceThresholds({
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

const updatePriceThreshold = async (req, res, next) => {
  try {
    const result = await adminService.updatePriceThreshold({
      province: req.params.province,
      payload: req.body,
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

const listSystemConfigs = async (req, res, next) => {
  try {
    const result = await adminService.listSystemConfigs({
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

const updateSystemConfig = async (req, res, next) => {
  try {
    const result = await adminService.updateSystemConfig({
      key: req.params.key,
      payload: req.body,
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
  createUser,
  deleteUser,
  listAnomalyLogs,
  listAuditLogs,
  listPriceThresholds,
  listRoles,
  listSystemConfigs,
  listUsers,
  lockDistribution,
  overrideDistribution,
  resolveAnomalyLog,
  unlockDistribution,
  updatePriceThreshold,
  updateSystemConfig,
  updateUserStatus,
  updateUser
};
