const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const { corsOptions } = require("./config/cors");
const { env } = require("./config/env");
const { storageConfig } = require("./config/storage");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const { applyApiReadRateLimit } = require("./middlewares/rateLimiter");
const { enforceHttps, sanitizeRequestInput } = require("./middlewares/security");
const apiRoutes = require("./routes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(enforceHttps);
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);
app.use(cors(corsOptions));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(sanitizeRequestInput);
app.use("/storage", express.static(path.resolve(storageConfig.localStorageRoot)));

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      service: "MBG Transparency System Backend"
    }
  });
});

app.use("/api", applyApiReadRateLimit, apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
