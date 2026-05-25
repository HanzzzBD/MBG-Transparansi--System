const adminService = require("../admin/service");
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

module.exports = {
  createUser,
  deleteUser,
  listUsers,
  updateUser
};
