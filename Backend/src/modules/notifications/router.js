const express = require("express");

const controller = require("./controller");
const {
  listNotificationsSchema,
  notificationIdParamsSchema,
  readAllNotificationsSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get("/", validateRequest(listNotificationsSchema), controller.listNotifications);
router.put("/read-all", validateRequest(readAllNotificationsSchema), controller.markAllNotificationsAsRead);
router.put("/:id/read", validateRequest(notificationIdParamsSchema), controller.markNotificationAsRead);

module.exports = router;
