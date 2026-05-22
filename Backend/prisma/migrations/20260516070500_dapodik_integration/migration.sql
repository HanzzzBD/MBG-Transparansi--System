ALTER TABLE "schools"
  ADD COLUMN "district" TEXT,
  ADD COLUMN "npsn" TEXT,
  ADD COLUMN "dapodik_school_id" TEXT,
  ADD COLUMN "education_level" TEXT,
  ADD COLUMN "school_status" TEXT,
  ADD COLUMN "dapodik_synced_at" TIMESTAMP(3);

CREATE TABLE "dapodik_schools" (
  "id" SERIAL NOT NULL,
  "semester_id" TEXT NOT NULL,
  "dapodik_school_id" TEXT,
  "npsn" TEXT,
  "name" TEXT NOT NULL,
  "province" TEXT,
  "city" TEXT,
  "district" TEXT,
  "education_level" TEXT,
  "school_status" TEXT,
  "student_count" INTEGER,
  "kode_wilayah" TEXT,
  "id_level_wilayah" INTEGER,
  "raw_data" JSONB NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  "last_sync_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dapodik_schools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schools_npsn_key" ON "schools" ("npsn");
CREATE UNIQUE INDEX "schools_dapodik_school_id_key" ON "schools" ("dapodik_school_id");
CREATE UNIQUE INDEX "dapodik_schools_semester_dapodik_school_key"
  ON "dapodik_schools" ("semester_id", "dapodik_school_id");
CREATE UNIQUE INDEX "dapodik_schools_semester_npsn_key"
  ON "dapodik_schools" ("semester_id", "npsn");
CREATE INDEX "idx_schools_district" ON "schools" ("district");
CREATE INDEX "idx_schools_education_level" ON "schools" ("education_level");
CREATE INDEX "idx_schools_school_status" ON "schools" ("school_status");
CREATE INDEX "idx_dapodik_schools_location" ON "dapodik_schools" ("province", "city", "district");
CREATE INDEX "idx_dapodik_schools_kode_wilayah" ON "dapodik_schools" ("kode_wilayah");
CREATE INDEX "idx_dapodik_schools_education_level" ON "dapodik_schools" ("education_level");
CREATE INDEX "idx_dapodik_schools_school_status" ON "dapodik_schools" ("school_status");
CREATE INDEX "idx_dapodik_schools_fetched_at" ON "dapodik_schools" ("fetched_at");
