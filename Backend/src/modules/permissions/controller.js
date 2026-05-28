const permissionService = require("./service");
const { getClientIp } = require("../../utils/request");

const listPermissions = async (_req, res, next) => {
  try {
    const result = await permissionService.listPermissions();

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getMyPermissions = async (req, res, next) => {
  try {
    const result = await permissionService.getUserPermissionSummary(req.user.userId);

    res.status(200).json({
      status: "success",
      data: {
        user: result.user,
        role: result.user.role,
        effectivePermissions: result.effectivePermissions
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserPermissions = async (req, res, next) => {
  try {
    const result = await permissionService.getUserPermissionSummary(req.params.id);

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const grantUserPermission = async (req, res, next) => {
  try {
    const result = await permissionService.grantUserPermission({
      targetUserId: req.params.id,
      permissionKey: req.body.permissionKey,
      actorUserId: req.user.userId,
      reason: req.body.reason,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const revokeUserPermission = async (req, res, next) => {
  try {
    const result = await permissionService.revokeUserPermission({
      targetUserId: req.params.id,
      permissionKey: req.body.permissionKey,
      actorUserId: req.user.userId,
      reason: req.body.reason,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const denyUserPermission = async (req, res, next) => {
  try {
    const result = await permissionService.denyUserPermission({
      targetUserId: req.params.id,
      permissionKey: req.body.permissionKey,
      actorUserId: req.user.userId,
      reason: req.body.reason,
      ipAddress: getClientIp(req)
    });

    res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const resetUserPermissionOverride = async (req, res, next) => {
  try {
    const result = await permissionService.resetUserPermissionOverride({
      targetUserId: req.params.id,
      permissionKey: req.params.permissionKey,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
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
  denyUserPermission,
  getMyPermissions,
  getUserPermissions,
  grantUserPermission,
  listPermissions,
  resetUserPermissionOverride,
  revokeUserPermission
};
