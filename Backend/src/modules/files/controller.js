const fileService = require("./service");
const { getClientIp } = require("../../utils/request");

const uploadFile = async (req, res, next) => {
  try {
    const result = await fileService.uploadFile({
      file: req.file,
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

module.exports = {
  uploadFile
};
