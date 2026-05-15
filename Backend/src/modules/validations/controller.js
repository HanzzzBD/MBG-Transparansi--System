const validationService = require("./service");
const { getClientIp } = require("../../utils/request");

const listValidations = async (req, res, next) => {
  try {
    const result = await validationService.listValidations({
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

const getValidationDetail = async (req, res, next) => {
  try {
    const result = await validationService.getValidationDetail({
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

const updateValidation = async (req, res, next) => {
  try {
    const result = await validationService.updateValidation({
      id: req.params.id,
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

module.exports = {
  getValidationDetail,
  listValidations,
  updateValidation
};
