const sppgService = require("./service");
const { getClientIp } = require("../../utils/request");

const listSppg = async (req, res, next) => {
  try {
    const result = await sppgService.listSppg({
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

const listMapMarkers = async (req, res, next) => {
  try {
    const result = await sppgService.listMapMarkers({
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

const listDeletedSppg = async (req, res, next) => {
  try {
    const result = await sppgService.listDeletedSppg({
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

const listMySchools = async (req, res, next) => {
  try {
    const result = await sppgService.listMySchools({
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

const listMyDapodikSchools = async (req, res, next) => {
  try {
    const result = await sppgService.listMyDapodikSchools({
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

const assignMySchools = async (req, res, next) => {
  try {
    const result = await sppgService.assignSchoolsToSppg({
      payload: req.body,
      user: req.user,
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

const unassignMySchool = async (req, res, next) => {
  try {
    const result = await sppgService.unassignSchoolFromSppg({
      assignmentId: req.params.assignmentId,
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

const listAdminSppgSchools = async (req, res, next) => {
  try {
    const result = await sppgService.listAssignedSchoolsForSppg({
      sppgId: req.params.id,
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

const assignAdminSppgSchools = async (req, res, next) => {
  try {
    const result = await sppgService.assignSchoolsToSppg({
      sppgId: req.params.id,
      payload: req.body,
      user: req.user,
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

const unassignAdminSppgSchool = async (req, res, next) => {
  try {
    const result = await sppgService.unassignSchoolFromSppg({
      sppgId: req.params.id,
      assignmentId: req.params.assignmentId,
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

const getSppgDetail = async (req, res, next) => {
  try {
    const result = await sppgService.getSppgDetail({
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

const getSppgOperationalDetail = async (req, res, next) => {
  try {
    const result = await sppgService.getSppgOperationalDetail({
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

const createSppg = async (req, res, next) => {
  try {
    const result = await sppgService.createSppg({
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

const updateSppg = async (req, res, next) => {
  try {
    const result = await sppgService.updateSppg({
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

const updateMySppgProfile = async (req, res, next) => {
  try {
    const result = await sppgService.updateMySppgProfile({
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

const deleteSppg = async (req, res, next) => {
  try {
    const result = await sppgService.deleteSppg({
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

const restoreSppg = async (req, res, next) => {
  try {
    const result = await sppgService.restoreSppg({
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
  createSppg,
  assignAdminSppgSchools,
  assignMySchools,
  deleteSppg,
  getSppgOperationalDetail,
  getSppgDetail,
  listDeletedSppg,
  listAdminSppgSchools,
  listMyDapodikSchools,
  listMapMarkers,
  listMySchools,
  listSppg,
  restoreSppg,
  unassignAdminSppgSchool,
  unassignMySchool,
  updateMySppgProfile,
  updateSppg
};
