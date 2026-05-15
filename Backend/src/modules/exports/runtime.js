const cron = require("node-cron");

const { env } = require("../../config/env");
const { processExportJob, cleanupExpiredExports } = require("./processor");

const EXPORT_QUEUE_NAME = "mbg-export-jobs";
const CLEANUP_CRON_EXPRESSION = "0 2 * * *";

let queueInstance;
let workerInstance;
let queueEventsInstance;
let cleanupTask;

const hasRedisQueue = () => Boolean(env.REDIS_URL);

const createBullMqConnection = () => {
  const Redis = require("ioredis");

  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });
};

const initializeCleanupTask = () => {
  if (cleanupTask) {
    return;
  }

  cleanupTask = cron.schedule(
    CLEANUP_CRON_EXPRESSION,
    async () => {
      try {
        await cleanupExpiredExports();
      } catch (error) {
        console.error("Export cleanup failed:", error);
      }
    },
    {
      timezone: "Asia/Jakarta"
    }
  );
};

const initializeExportRuntime = () => {
  initializeCleanupTask();

  if (!hasRedisQueue() || queueInstance) {
    return;
  }

  const { Queue, QueueEvents, Worker } = require("bullmq");

  queueInstance = new Queue(EXPORT_QUEUE_NAME, {
    connection: createBullMqConnection()
  });

  workerInstance = new Worker(
    EXPORT_QUEUE_NAME,
    async (job) => {
      await processExportJob({
        exportId: job.data.exportId
      });
    },
    {
      connection: createBullMqConnection()
    }
  );

  queueEventsInstance = new QueueEvents(EXPORT_QUEUE_NAME, {
    connection: createBullMqConnection()
  });

  workerInstance.on("failed", (job, error) => {
    console.error(`Export job ${job?.id || "unknown"} failed:`, error);
  });

  queueEventsInstance.on("error", (error) => {
    console.error("Export queue events error:", error);
  });
};

const enqueueExportJob = async ({ exportId }) => {
  if (!hasRedisQueue()) {
    setImmediate(async () => {
      try {
        await processExportJob({ exportId });
      } catch (error) {
        console.error(`Local export job ${exportId} failed:`, error);
      }
    });

    return {
      queued: true,
      mode: "local"
    };
  }

  initializeExportRuntime();

  await queueInstance.add("process-export", { exportId });

  return {
    queued: true,
    mode: "bullmq"
  };
};

const shutdownExportRuntime = async () => {
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
  }

  if (queueEventsInstance) {
    await queueEventsInstance.close();
    queueEventsInstance = null;
  }

  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }

  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
};

module.exports = {
  enqueueExportJob,
  initializeExportRuntime,
  shutdownExportRuntime
};
