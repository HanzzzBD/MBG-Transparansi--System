const notificationService = require("./service");
const { getClientIp } = require("../../utils/request");

const listNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.listNotifications({
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

const markNotificationAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markNotificationAsRead({
      id: req.params.id,
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

const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsAsRead({
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
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
};
