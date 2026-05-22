const dapodikService = require("./service");
const { getClientIp } = require("../../utils/request");

const getRegionRecap = async (req, res, next) => {
  try {
    const result = await dapodikService.getRegionRecap({
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

const getSchoolProgress = async (req, res, next) => {
  try {
    const result = await dapodikService.getSchoolProgress({
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

const syncSchoolProgress = async (req, res, next) => {
  try {
    const result = await dapodikService.syncSchoolProgress({
      payload: req.body
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

const listStagedSchools = async (req, res, next) => {
  try {
    const result = await dapodikService.listStagedSchools({
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

const getStagedSchoolDetail = async (req, res, next) => {
  try {
    const result = await dapodikService.getStagedSchoolDetail({
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

const promoteStagedSchool = async (req, res, next) => {
  try {
    const result = await dapodikService.promoteStagedSchool({
      id: req.params.id,
      payload: req.body,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
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

const linkStagedSchool = async (req, res, next) => {
  try {
    const result = await dapodikService.linkStagedSchool({
      id: req.params.id,
      payload: req.body,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
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

const importStagedSchools = async (req, res, next) => {
  try {
    const result = await dapodikService.importStagedSchools({
      payload: req.body,
      file: req.file || null,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      status: "success",
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    next(error);
  }
};

const getLatestSyncLog = async (req, res, next) => {
  try {
    const result = await dapodikService.getLatestSyncLog({
      query: req.query
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
  getRegionRecap,
  getSchoolProgress,
  getStagedSchoolDetail,
  getLatestSyncLog,
  importStagedSchools,
  linkStagedSchool,
  listStagedSchools,
  promoteStagedSchool,
  syncSchoolProgress
};
