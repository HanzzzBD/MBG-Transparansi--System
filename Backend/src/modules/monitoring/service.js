const { performance } = require("perf_hooks");

const { env } = require("../../config/env");
const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const { importFoodPrices } = require("../foodPrices/importer");
const dapodikService = require("../dapodik/service");

const prisma = getPrismaClient();

const API_ITEMS = [
  {
    id: "auth-service",
    name: "Auth service",
    type: "api"
  },
  {
    id: "reporting-api",
    name: "Reporting API",
    type: "api"
  },
  {
    id: "export-queue",
    name: "Export queue",
    type: "queue"
  },
  {
    id: "background-jobs",
    name: "Background jobs",
    type: "worker"
  }
];

const SYNC_SOURCE_ITEMS = [
  {
    id: "sp2kp-sync",
    name: "SP2KP sync",
    source: "sp2kp"
  },
  {
    id: "dapodik-sync",
    name: "Dapodik sync",
    source: "dapodik"
  }
];

const nowIso = () => new Date().toISOString();

const asIso = (value) => (value ? new Date(value).toISOString() : null);

const measureLatency = async (callback) => {
  const start = performance.now();
  const data = await callback();
  const latency = Math.max(1, Math.round(performance.now() - start));

  return {
    data,
    latency
  };
};

const toStatus = ({ errors = 0, queueSize = 0, disabled = false }) => {
  if (disabled) return "disabled";
  if (errors > 0) return "warning";
  if (queueSize > 0) return "processing";
  return "ok";
};

const getTodayRange = () => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    gte: startOfDayUtc(today),
    lte: endOfDayUtc(today)
  };
};

const getLatestDapodikSyncLog = () =>
  prisma.dapodikSyncLog.findFirst({
    orderBy: [{ createdAt: "desc" }]
  });

const getApiStatusItem = async (id) => {
  if (id === "auth-service") {
    const { data, latency } = await measureLatency(async () => {
      const todayRange = getTodayRange();
      const [lastAttempt, failedToday] = await Promise.all([
        prisma.loginAttempt.findFirst({
          orderBy: [{ createdAt: "desc" }]
        }),
        prisma.loginAttempt.count({
          where: {
            success: false,
            createdAt: todayRange
          }
        })
      ]);

      return {
        lastAttempt,
        failedToday
      };
    });

    return {
      id,
      name: "Auth service",
      latency,
      uptime: process.uptime(),
      last_sync: asIso(data.lastAttempt?.createdAt),
      lastSync: asIso(data.lastAttempt?.createdAt),
      error_count: data.failedToday,
      errorCount: data.failedToday,
      status: toStatus({ errors: data.failedToday }),
      queue_size: 0,
      queueSize: 0
    };
  }

  if (id === "reporting-api") {
    const { data, latency } = await measureLatency(async () => {
      const [lastReport, openReports] = await Promise.all([
        prisma.publicReport.findFirst({
          orderBy: [{ createdAt: "desc" }]
        }),
        prisma.publicReport.count({
          where: {
            status: {
              in: ["baru", "ditinjau"]
            }
          }
        })
      ]);

      return {
        lastReport,
        openReports
      };
    });

    return {
      id,
      name: "Reporting API",
      latency,
      uptime: process.uptime(),
      last_sync: asIso(data.lastReport?.followedUpAt || data.lastReport?.createdAt),
      lastSync: asIso(data.lastReport?.followedUpAt || data.lastReport?.createdAt),
      error_count: 0,
      errorCount: 0,
      status: toStatus({ queueSize: data.openReports }),
      queue_size: data.openReports,
      queueSize: data.openReports
    };
  }

  if (id === "export-queue") {
    const { data, latency } = await measureLatency(async () => {
      const [lastExport, queueSize, failedExports] = await Promise.all([
        prisma.export.findFirst({
          orderBy: [{ updatedAt: "desc" }]
        }),
        prisma.export.count({
          where: {
            status: {
              in: ["pending", "processing"]
            }
          }
        }),
        prisma.export.count({
          where: {
            status: "failed"
          }
        })
      ]);

      return {
        failedExports,
        lastExport,
        queueSize
      };
    });

    return {
      id,
      name: "Export queue",
      latency,
      uptime: process.uptime(),
      last_sync: asIso(data.lastExport?.updatedAt),
      lastSync: asIso(data.lastExport?.updatedAt),
      error_count: data.failedExports,
      errorCount: data.failedExports,
      status: toStatus({ errors: data.failedExports, queueSize: data.queueSize }),
      queue_size: data.queueSize,
      queueSize: data.queueSize
    };
  }

  if (id === "background-jobs") {
    const { data, latency } = await measureLatency(async () => {
      const [unreadNotifications, unresolvedAnomalies, lastNotification] = await Promise.all([
        prisma.notification.count({
          where: {
            isRead: false
          }
        }),
        prisma.anomalyLog.count({
          where: {
            isResolved: false
          }
        }),
        prisma.notification.findFirst({
          orderBy: [{ createdAt: "desc" }]
        })
      ]);

      return {
        lastNotification,
        unreadNotifications,
        unresolvedAnomalies
      };
    });

    return {
      id,
      name: "Background jobs",
      latency,
      uptime: process.uptime(),
      last_sync: asIso(data.lastNotification?.createdAt),
      lastSync: asIso(data.lastNotification?.createdAt),
      error_count: data.unresolvedAnomalies,
      errorCount: data.unresolvedAnomalies,
      status: toStatus({ errors: data.unresolvedAnomalies, queueSize: data.unreadNotifications }),
      queue_size: data.unreadNotifications,
      queueSize: data.unreadNotifications
    };
  }

  throw new AppError("Monitoring API item not found.", 404, "MONITORING_API_NOT_FOUND");
};

const getSyncSourceItem = async (id) => {
  if (id === "sp2kp-sync") {
    const { data, latency } = await measureLatency(async () => {
      const [latestDate, totalRows] = await Promise.all([
        prisma.foodPrice.aggregate({
          _max: {
            date: true
          }
        }),
        prisma.foodPrice.count()
      ]);

      return {
        latestDate: latestDate._max.date,
        totalRows
      };
    });

    return {
      id,
      name: "SP2KP sync",
      latency,
      uptime: process.uptime(),
      last_sync: asIso(data.latestDate),
      lastSync: asIso(data.latestDate),
      error_count: 0,
      errorCount: 0,
      status: data.totalRows > 0 ? "ok" : "empty",
      queue_size: 0,
      queueSize: 0
    };
  }

  if (id === "dapodik-sync") {
    const { data, latency } = await measureLatency(async () => {
      const [latestLog, latestSchool, errorCount] = await Promise.all([
        getLatestDapodikSyncLog(),
        prisma.dapodikSchool.findFirst({
          orderBy: [{ fetchedAt: "desc" }]
        }),
        prisma.dapodikSyncLog.count({
          where: {
            status: {
              notIn: ["success", "completed", "ok"]
            }
          }
        })
      ]);

      return {
        errorCount,
        latestLog,
        latestSchool
      };
    });
    const disabled = data.latestLog?.status === "disabled";

    return {
      id,
      name: "Dapodik sync",
      latency,
      uptime: process.uptime(),
      last_sync: asIso(data.latestLog?.finishedAt || data.latestSchool?.fetchedAt),
      lastSync: asIso(data.latestLog?.finishedAt || data.latestSchool?.fetchedAt),
      error_count: data.errorCount,
      errorCount: data.errorCount,
      status: toStatus({ errors: data.errorCount, disabled }),
      queue_size: 0,
      queueSize: 0
    };
  }

  throw new AppError("Monitoring sync source not found.", 404, "MONITORING_SYNC_SOURCE_NOT_FOUND");
};

const listApiItems = async () => ({
  data: await Promise.all(API_ITEMS.map((item) => getApiStatusItem(item.id)))
});

const listSyncSources = async () => ({
  data: await Promise.all(SYNC_SOURCE_ITEMS.map((item) => getSyncSourceItem(item.id)))
});

const getMonitoringSummary = async () => {
  const [apis, syncSources] = await Promise.all([listApiItems(), listSyncSources()]);
  const allItems = [...apis.data, ...syncSources.data];
  const errorCount = allItems.reduce((total, item) => total + Number(item.error_count || 0), 0);
  const queueSize = allItems.reduce((total, item) => total + Number(item.queue_size || 0), 0);
  const warningCount = allItems.filter((item) => ["warning", "disabled", "empty"].includes(item.status)).length;

  return {
    data: {
      service: "MBG Transparency System Backend",
      status: errorCount > 0 || warningCount > 0 ? "warning" : "ok",
      timestamp: nowIso(),
      uptime: process.uptime(),
      latency: Math.max(...allItems.map((item) => Number(item.latency || 0))),
      last_sync: allItems
        .map((item) => item.last_sync)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
      error_count: errorCount,
      queue_size: queueSize,
      totals: {
        apiTotal: apis.data.length,
        syncSourceTotal: syncSources.data.length,
        warningCount,
        errorCount,
        queueSize
      },
      apis: apis.data,
      syncSources: syncSources.data
    }
  };
};

const listErrors = async () => {
  const [failedExports, failedLoginAttempts, dapodikErrors, unresolvedAnomalies] = await Promise.all([
    prisma.export.findMany({
      where: {
        status: "failed"
      },
      take: 10,
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.loginAttempt.findMany({
      where: {
        success: false
      },
      take: 10,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.dapodikSyncLog.findMany({
      where: {
        status: {
          notIn: ["success", "completed", "ok"]
        }
      },
      take: 10,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.anomalyLog.findMany({
      where: {
        isResolved: false
      },
      take: 10,
      orderBy: [{ createdAt: "desc" }]
    })
  ]);

  const data = [
    ...failedExports.map((item) => ({
      id: `export-${item.id}`,
      source: "Export queue",
      status: "failed",
      severity: "HIGH",
      message: item.errorMsg || "Export failed.",
      created_at: item.updatedAt
    })),
    ...failedLoginAttempts.map((item) => ({
      id: `login-${item.id}`,
      source: "Auth service",
      status: "failed_login",
      severity: "MEDIUM",
      message: `Failed login attempt for ${item.email}.`,
      created_at: item.createdAt
    })),
    ...dapodikErrors.map((item) => ({
      id: `dapodik-${item.id}`,
      source: "Dapodik sync",
      status: item.status,
      severity: item.status === "disabled" ? "MEDIUM" : "HIGH",
      message: item.errorMessage || item.errorCode || "Dapodik sync did not complete successfully.",
      created_at: item.createdAt
    })),
    ...unresolvedAnomalies.map((item) => ({
      id: `anomaly-${item.id}`,
      source: "Background jobs",
      status: "unresolved_anomaly",
      severity: "MEDIUM",
      message: item.description,
      created_at: item.createdAt
    }))
  ].sort((first, second) => new Date(second.created_at) - new Date(first.created_at));

  return {
    data
  };
};

const testApiItem = async ({ id }) => ({
  data: {
    ...(await getApiStatusItem(id)),
    tested_at: nowIso(),
    testedAt: nowIso()
  }
});

const syncSource = async ({ id }) => {
  if (id === "sp2kp-sync") {
    if (!env.FOOD_PRICES_PATH) {
      throw new AppError("FOOD_PRICES_PATH is not configured.", 409, "SP2KP_SYNC_PATH_MISSING");
    }

    const result = await importFoodPrices({
      targetPath: env.FOOD_PRICES_PATH,
      latest: true
    });

    return {
      data: {
        id,
        status: "success",
        synced_at: nowIso(),
        syncedAt: nowIso(),
        result
      }
    };
  }

  if (id === "dapodik-sync") {
    try {
      const result = await dapodikService.syncSchoolProgress({
        payload: {}
      });

      return {
        data: {
          id,
          status: "success",
          synced_at: nowIso(),
          syncedAt: nowIso(),
          result: result.data || result
        }
      };
    } catch (error) {
      if (error.code === "DAPODIK_UPSTREAM_DISABLED") {
        return {
          data: {
            id,
            status: "disabled",
            synced_at: nowIso(),
            syncedAt: nowIso(),
            message: error.message
          }
        };
      }

      throw error;
    }
  }

  throw new AppError("Monitoring sync source not found.", 404, "MONITORING_SYNC_SOURCE_NOT_FOUND");
};

module.exports = {
  getMonitoringSummary,
  listApiItems,
  listErrors,
  listSyncSources,
  syncSource,
  testApiItem
};
