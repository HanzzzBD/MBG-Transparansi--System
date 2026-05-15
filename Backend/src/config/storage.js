const path = require("path");
const { env } = require("./env");

const localStorageRoot = path.resolve(process.cwd(), "storage");

const storageConfig = {
  provider: env.R2_BUCKET_NAME ? "r2" : "local",
  localStorageRoot,
  localUploadDir: path.resolve(localStorageRoot, "uploads"),
  localExportDir: path.resolve(localStorageRoot, "exports"),
  r2: {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL
  }
};

module.exports = {
  storageConfig
};
