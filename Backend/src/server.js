const http = require("http");

const app = require("./app");
const { env } = require("./config/env");
const { initializeExportRuntime, shutdownExportRuntime } = require("./modules/exports/runtime");
const {
  initializeNotificationRuntime,
  shutdownNotificationRuntime
} = require("./modules/notifications/runtime");
const { initializeSocketServer, shutdownSocketServer } = require("./utils/socket");

initializeExportRuntime();
initializeNotificationRuntime();

const server = http.createServer(app);

initializeSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`MBG backend listening on port ${env.PORT}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully.`);

  await shutdownSocketServer();
  shutdownNotificationRuntime();
  await shutdownExportRuntime();

  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
