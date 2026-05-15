const issueService = require("./service");
const { getClientIp } = require("../../utils/request");

const listIssues = async (req, res, next) => {
  try {
    const result = await issueService.listIssues({
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

const createIssue = async (req, res, next) => {
  try {
    const result = await issueService.createIssue({
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

const updateIssueStatus = async (req, res, next) => {
  try {
    const result = await issueService.updateIssueStatus({
      id: req.params.id,
      status: req.body.status,
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

module.exports = {
  createIssue,
  listIssues,
  updateIssueStatus
};
