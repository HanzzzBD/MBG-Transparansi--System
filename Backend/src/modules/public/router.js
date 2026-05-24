const express = require("express");

const controller = require("./controller");
const { publicSppgIdParamsSchema, publicSppgListSchema } = require("./validation");
const { publicSppgLimiter } = require("../../middlewares/rateLimiter");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get("/sppg", publicSppgLimiter, validateRequest(publicSppgListSchema), controller.listPublicSppg);
router.get("/sppg/:id", publicSppgLimiter, validateRequest(publicSppgIdParamsSchema), controller.getPublicSppgDetail);

module.exports = router;
