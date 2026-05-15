CREATE TYPE "UserRole" AS ENUM ('admin', 'pemerintah', 'sppg', 'sekolah', 'umum');
CREATE TYPE "SppgStatus" AS ENUM ('active', 'inactive', 'problem');
CREATE TYPE "DistributionStatus" AS ENUM ('in_progress', 'delivered', 'failed');
CREATE TYPE "ValidationStatus" AS ENUM ('verified', 'conflict', 'pending');
CREATE TYPE "IssueCategory" AS ENUM ('logistik', 'keterlambatan', 'kekurangan_bahan', 'peralatan', 'lainnya');
CREATE TYPE "IssueStatus" AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE "ReportCategory" AS ENUM ('kualitas_makanan', 'keterlambatan', 'kekurangan_porsi', 'lainnya');
CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK');
CREATE TYPE "AnomalyType" AS ENUM ('OVER_CAPACITY', 'PRICE_ANOMALY', 'VALIDATION_CONFLICT', 'PENDING_TIMEOUT');
CREATE TYPE "FileStatus" AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE "ExportType" AS ENUM ('pdf', 'excel');
CREATE TYPE "ExportStatus" AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE "NotificationType" AS ENUM ('distribution', 'validation', 'anomaly', 'system');

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "sppg_id" INTEGER,
  "school_id" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email")
);

CREATE TABLE "user_sessions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "is_revoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_sessions_refresh_token_key" UNIQUE ("refresh_token")
);

CREATE TABLE "sppg" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "capacity" INTEGER NOT NULL CHECK ("capacity" > 0),
  "workers" INTEGER,
  "pic_name" TEXT,
  "pic_phone" TEXT,
  "status" "SppgStatus" NOT NULL DEFAULT 'active',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sppg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schools" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "sppg_id" INTEGER NOT NULL,
  "total_students" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "distributions" (
  "id" SERIAL NOT NULL,
  "sppg_id" INTEGER NOT NULL,
  "school_id" INTEGER NOT NULL,
  "portions" INTEGER NOT NULL CHECK ("portions" > 0),
  "price_per_portion" NUMERIC(10, 2) NOT NULL CHECK ("price_per_portion" > 0),
  "total_cost" NUMERIC(12, 2) GENERATED ALWAYS AS ("portions" * "price_per_portion") STORED,
  "distribution_date" DATE NOT NULL,
  "status" "DistributionStatus" NOT NULL DEFAULT 'in_progress',
  "failure_reason" TEXT,
  "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validations" (
  "id" SERIAL NOT NULL,
  "distribution_id" INTEGER NOT NULL,
  "school_id" INTEGER NOT NULL,
  "received_portions" INTEGER NOT NULL CHECK ("received_portions" >= 0),
  "quality_ok" BOOLEAN,
  "status" "ValidationStatus" NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "validated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "validations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "validations_distribution_id_key" UNIQUE ("distribution_id")
);

CREATE TABLE "menus" (
  "id" SERIAL NOT NULL,
  "sppg_id" INTEGER NOT NULL,
  "menu_date" DATE NOT NULL,
  "menu_name" TEXT NOT NULL,
  "calories" INTEGER CHECK ("calories" > 0),
  "protein_g" INTEGER CHECK ("protein_g" >= 0),
  "carbs_g" INTEGER CHECK ("carbs_g" >= 0),
  "fat_g" INTEGER CHECK ("fat_g" >= 0),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "menus_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menus_sppg_id_menu_date_key" UNIQUE ("sppg_id", "menu_date")
);

CREATE TABLE "files" (
  "id" SERIAL NOT NULL,
  "original_name" TEXT NOT NULL,
  "stored_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL CHECK ("size_bytes" > 0),
  "uploaded_by" INTEGER NOT NULL,
  "status" "FileStatus" NOT NULL DEFAULT 'processing',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "files_stored_name_key" UNIQUE ("stored_name")
);

CREATE TABLE "proofs" (
  "id" SERIAL NOT NULL,
  "distribution_id" INTEGER NOT NULL,
  "file_id" INTEGER NOT NULL,
  "uploaded_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proofs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issues" (
  "id" SERIAL NOT NULL,
  "sppg_id" INTEGER NOT NULL,
  "reported_by" INTEGER NOT NULL,
  "category" "IssueCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "IssueStatus" NOT NULL DEFAULT 'open',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_reports" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "reported_by" INTEGER NOT NULL,
  "category" "ReportCategory" NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_reports" (
  "id" SERIAL NOT NULL,
  "reporter_name" TEXT,
  "category" "ReportCategory" NOT NULL,
  "message" TEXT NOT NULL,
  "province" TEXT,
  "city" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "action" "AuditAction" NOT NULL,
  "table_name" TEXT NOT NULL,
  "record_id" INTEGER NOT NULL,
  "old_data" JSONB,
  "new_data" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "anomaly_logs" (
  "id" SERIAL NOT NULL,
  "distribution_id" INTEGER NOT NULL,
  "anomaly_type" "AnomalyType" NOT NULL,
  "description" TEXT NOT NULL,
  "is_resolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "resolved_by" INTEGER,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anomaly_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exports" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" "ExportType" NOT NULL,
  "filter_params" JSONB,
  "status" "ExportStatus" NOT NULL DEFAULT 'pending',
  "file_id" INTEGER,
  "error_msg" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_thresholds" (
  "id" SERIAL NOT NULL,
  "province" TEXT NOT NULL,
  "min_price" NUMERIC(10, 2) NOT NULL CHECK ("min_price" > 0),
  "max_price" NUMERIC(10, 2) NOT NULL CHECK ("max_price" > "min_price"),
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_thresholds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_thresholds_province_key" UNIQUE ("province")
);

CREATE TABLE "system_configs" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "description" TEXT,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_configs_key_key" UNIQUE ("key")
);

CREATE TABLE "login_attempts" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "ip_address" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_sppg_id_fkey"
  FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schools"
  ADD CONSTRAINT "schools_sppg_id_fkey"
  FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "distributions"
  ADD CONSTRAINT "distributions_sppg_id_fkey"
  FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "distributions"
  ADD CONSTRAINT "distributions_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "validations"
  ADD CONSTRAINT "validations_distribution_id_fkey"
  FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "validations"
  ADD CONSTRAINT "validations_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "menus"
  ADD CONSTRAINT "menus_sppg_id_fkey"
  FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "files"
  ADD CONSTRAINT "files_uploaded_by_fkey"
  FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proofs"
  ADD CONSTRAINT "proofs_distribution_id_fkey"
  FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proofs"
  ADD CONSTRAINT "proofs_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proofs"
  ADD CONSTRAINT "proofs_uploaded_by_fkey"
  FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "issues"
  ADD CONSTRAINT "issues_sppg_id_fkey"
  FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "issues"
  ADD CONSTRAINT "issues_reported_by_fkey"
  FOREIGN KEY ("reported_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school_reports"
  ADD CONSTRAINT "school_reports_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_reports"
  ADD CONSTRAINT "school_reports_reported_by_fkey"
  FOREIGN KEY ("reported_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "anomaly_logs"
  ADD CONSTRAINT "anomaly_logs_distribution_id_fkey"
  FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "anomaly_logs"
  ADD CONSTRAINT "anomaly_logs_resolved_by_fkey"
  FOREIGN KEY ("resolved_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exports"
  ADD CONSTRAINT "exports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exports"
  ADD CONSTRAINT "exports_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "files"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "price_thresholds"
  ADD CONSTRAINT "price_thresholds_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "system_configs"
  ADD CONSTRAINT "system_configs_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_sessions_user" ON "user_sessions" ("user_id");
CREATE INDEX "idx_sessions_token" ON "user_sessions" ("refresh_token");
CREATE INDEX "idx_sppg_location" ON "sppg" ("province", "city");
CREATE INDEX "idx_sppg_status" ON "sppg" ("status");
CREATE INDEX "idx_sppg_deleted_at" ON "sppg" ("deleted_at");
CREATE INDEX "idx_sppg_active" ON "sppg" ("id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_schools_sppg" ON "schools" ("sppg_id");
CREATE INDEX "idx_schools_location" ON "schools" ("province", "city");
CREATE INDEX "idx_schools_deleted_at" ON "schools" ("deleted_at");
CREATE INDEX "idx_schools_active" ON "schools" ("id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_distributions_sppg" ON "distributions" ("sppg_id");
CREATE INDEX "idx_distributions_school" ON "distributions" ("school_id");
CREATE INDEX "idx_distributions_date" ON "distributions" ("distribution_date");
CREATE INDEX "idx_distributions_status" ON "distributions" ("status");
CREATE INDEX "idx_validations_school" ON "validations" ("school_id");
CREATE INDEX "idx_validations_status" ON "validations" ("status");
CREATE INDEX "idx_menus_deleted_at" ON "menus" ("deleted_at");
CREATE INDEX "idx_proofs_distribution" ON "proofs" ("distribution_id");
CREATE INDEX "idx_proofs_file" ON "proofs" ("file_id");
CREATE INDEX "idx_issues_sppg" ON "issues" ("sppg_id");
CREATE INDEX "idx_issues_status" ON "issues" ("status");
CREATE INDEX "idx_issues_deleted_at" ON "issues" ("deleted_at");
CREATE INDEX "idx_school_reports_school" ON "school_reports" ("school_id");
CREATE INDEX "idx_public_reports_category" ON "public_reports" ("category");
CREATE INDEX "idx_public_reports_location" ON "public_reports" ("province", "city");
CREATE INDEX "idx_audit_table_record" ON "audit_logs" ("table_name", "record_id");
CREATE INDEX "idx_audit_user" ON "audit_logs" ("user_id");
CREATE INDEX "idx_anomaly_logs_distribution" ON "anomaly_logs" ("distribution_id");
CREATE INDEX "idx_anomaly_logs_type_resolved" ON "anomaly_logs" ("anomaly_type", "is_resolved");
CREATE INDEX "idx_files_uploaded_by" ON "files" ("uploaded_by");
CREATE INDEX "idx_files_status" ON "files" ("status");
CREATE INDEX "idx_exports_user" ON "exports" ("user_id");
CREATE INDEX "idx_exports_status" ON "exports" ("status");
CREATE INDEX "idx_login_attempts_email" ON "login_attempts" ("email", "created_at");
CREATE INDEX "idx_login_attempts_ip" ON "login_attempts" ("ip_address", "created_at");
CREATE INDEX "idx_notifications_user_read" ON "notifications" ("user_id", "is_read");
CREATE INDEX "idx_notifications_created_at" ON "notifications" ("created_at");
CREATE INDEX "idx_users_deleted_at" ON "users" ("deleted_at");
CREATE INDEX "idx_users_sppg" ON "users" ("sppg_id");
CREATE INDEX "idx_users_school" ON "users" ("school_id");
CREATE INDEX "idx_users_active" ON "users" ("id") WHERE "deleted_at" IS NULL;
