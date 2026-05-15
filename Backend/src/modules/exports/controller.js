const exportService = require("./service");
const { getClientIp } = require("../../utils/request");
const { streamStoredObjectToResponse } = require("../../utils/storage");

const createExport = async (req, res, next) => {
  try {
    const result = await exportService.createExport({
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

const getExportDetail = async (req, res, next) => {
  try {
    const result = await exportService.getExportDetail({
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

const downloadExport = async (req, res, next) => {
  try {
    const result = await exportService.getExportDownloadPayload({
      id: req.params.id,
      user: req.user
    });

    await streamStoredObjectToResponse({
      res,
      storedName: result.data.file.storedName,
      downloadName: result.data.file.originalName,
      mimeType: result.data.file.mimeType
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExport,
  downloadExport,
  getExportDetail
};
