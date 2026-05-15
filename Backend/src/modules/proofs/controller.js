const proofService = require("./service");
const { getClientIp } = require("../../utils/request");

const createProof = async (req, res, next) => {
  try {
    const result = await proofService.createProof({
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

const listDistributionProofs = async (req, res, next) => {
  try {
    const result = await proofService.listDistributionProofs({
      distributionId: req.params.id,
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

module.exports = {
  createProof,
  listDistributionProofs
};
