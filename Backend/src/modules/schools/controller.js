const schoolService = require("./service");
const { getClientIp } = require("../../utils/request");

const listSchools = async (req, res, next) => {
  try {
    const result = await schoolService.listSchools({
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

const getSchoolDetail = async (req, res, next) => {
  try {
    const result = await schoolService.getSchoolDetail({
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

const listDeletedSchools = async (req, res, next) => {
  try {
    const result = await schoolService.listDeletedSchools({
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

const createSchool = async (req, res, next) => {
  try {
    const result = await schoolService.createSchool({
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

const updateSchool = async (req, res, next) => {
  try {
    const result = await schoolService.updateSchool({
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

const deleteSchool = async (req, res, next) => {
  try {
    const result = await schoolService.deleteSchool({
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

const restoreSchool = async (req, res, next) => {
  try {
    const result = await schoolService.restoreSchool({
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
  createSchool,
  deleteSchool,
  getSchoolDetail,
  listDeletedSchools,
  listSchools,
  restoreSchool,
  updateSchool
};
