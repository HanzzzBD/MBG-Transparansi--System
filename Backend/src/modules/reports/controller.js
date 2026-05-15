const reportService = require("./service");
const { getClientIp } = require("../../utils/request");

const createPublicReport = async (req, res, next) => {
  try {
    const result = await reportService.createPublicReport({
      payload: req.body,
      ipAddress: getClientIp(req)
    });

    res.status(result.statusCode || 201).json({
      status: "success",
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

const listPublicReports = async (req, res, next) => {
  try {
    const result = await reportService.listPublicReports({
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

const createSchoolReport = async (req, res, next) => {
  try {
    const result = await reportService.createSchoolReport({
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

const listSchoolReports = async (req, res, next) => {
  try {
    const result = await reportService.listSchoolReports({
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

module.exports = {
  createPublicReport,
  createSchoolReport,
  listPublicReports,
  listSchoolReports
};
