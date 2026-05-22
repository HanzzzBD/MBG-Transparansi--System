CREATE TABLE "dapodik_sync_logs" (
  "id" SERIAL NOT NULL,
  "endpoint" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "semester_id" TEXT,
  "kode_wilayah" TEXT,
  "id_level_wilayah" INTEGER,
  "education_level" TEXT,
  "request_params" JSONB NOT NULL,
  "result_meta" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dapodik_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_dapodik_sync_logs_endpoint_kode" ON "dapodik_sync_logs" ("endpoint", "kode_wilayah");
CREATE INDEX "idx_dapodik_sync_logs_status" ON "dapodik_sync_logs" ("status");
CREATE INDEX "idx_dapodik_sync_logs_created_at" ON "dapodik_sync_logs" ("created_at");
