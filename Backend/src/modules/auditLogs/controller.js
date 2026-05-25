const auditLogService = require("./service");

const listAuditLogs = async (req, res, next) => {
  try {
    const result = await auditLogService.listAuditLogs({
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

const getAuditLogsSummary = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogsSummary({
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

const getAuditLogDetail = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogDetail({
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
  getAuditLogDetail,
  getAuditLogsSummary,
  listAuditLogs
};
