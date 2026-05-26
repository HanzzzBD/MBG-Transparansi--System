const publicService = require("./service");

const getPublicStatistics = async (req, res, next) => {
  try {
    const result = await publicService.getPublicStatistics({
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

const getPublicBudget = async (req, res, next) => {
  try {
    const result = await publicService.getPublicBudget({
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

const listPublicSppg = async (req, res, next) => {
  try {
    const result = await publicService.getPublicSppgList({
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

const getPublicSppgDetail = async (req, res, next) => {
  try {
    const result = await publicService.getPublicSppgDetail({
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
  getPublicBudget,
  getPublicStatistics,
  listPublicSppg,
  getPublicSppgDetail
};
