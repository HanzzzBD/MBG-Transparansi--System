const express = require("express");

const controller = require("./controller");
const { apiIdSchema, syncSourceIdSchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/summary", controller.getSummary);
router.get("/apis", controller.listApis);
router.get("/errors", controller.listErrors);
router.get("/sync-sources", controller.listSyncSources);
router.post("/apis/:id/test", validateRequest(apiIdSchema), controller.testApi);
router.post("/sync-sources/:id/sync", validateRequest(syncSourceIdSchema), controller.syncSource);

module.exports = router;
