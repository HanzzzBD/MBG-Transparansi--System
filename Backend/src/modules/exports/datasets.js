const AppError = require("../../utils/appError");

const DEFAULT_EXPORT_DATASETS = ["distributions"];
const SUPPORTED_EXPORT_DATASETS = new Set([
  "distributions",
  "validations",
  "public_reports",
  "budget_by_region",
  "audit_logs",
  "anomalies",
  "production_batches",
  "food_prices"
]);
const ADMIN_ONLY_EXPORT_DATASETS = new Set(["audit_logs"]);

const normalizeExportDatasets = (filterParams = {}) => {
  const rawDatasets = Array.isArray(filterParams.datasets)
    ? filterParams.datasets
    : filterParams.dataset
      ? [filterParams.dataset]
      : DEFAULT_EXPORT_DATASETS;
  const datasetIds = [...new Set(rawDatasets.map((item) => String(item).trim()).filter(Boolean))];

  return datasetIds.length ? datasetIds : DEFAULT_EXPORT_DATASETS;
};

const assertExportDatasetsAllowed = ({ filterParams = {}, user }) => {
  const datasetIds = normalizeExportDatasets(filterParams);
  const unsupported = datasetIds.filter((datasetId) => !SUPPORTED_EXPORT_DATASETS.has(datasetId));

  if (unsupported.length) {
    throw new AppError(
      `Unsupported export dataset: ${unsupported.join(", ")}.`,
      400,
      "EXPORT_DATASET_UNSUPPORTED"
    );
  }

  if (user?.role !== "admin") {
    const forbidden = datasetIds.filter((datasetId) => ADMIN_ONLY_EXPORT_DATASETS.has(datasetId));

    if (forbidden.length) {
      throw new AppError(
        `Dataset ${forbidden.join(", ")} is only available for admin exports.`,
        403,
        "EXPORT_DATASET_FORBIDDEN"
      );
    }
  }

  return datasetIds;
};

module.exports = {
  ADMIN_ONLY_EXPORT_DATASETS,
  DEFAULT_EXPORT_DATASETS,
  SUPPORTED_EXPORT_DATASETS,
  assertExportDatasetsAllowed,
  normalizeExportDatasets
};
