CREATE TABLE "dapodik_provinces" (
  "id" SERIAL NOT NULL,
  "semester_id" TEXT,
  "kode_wilayah" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "id_level_wilayah" INTEGER NOT NULL,
  "url" TEXT,
  "summary" JSONB,
  "raw_data" JSONB,
  "import_batch_id" TEXT,
  "source_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dapodik_provinces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dapodik_cities" (
  "id" SERIAL NOT NULL,
  "semester_id" TEXT,
  "kode_wilayah" TEXT NOT NULL,
  "province_kode_wilayah" TEXT,
  "name" TEXT NOT NULL,
  "province_name" TEXT,
  "id_level_wilayah" INTEGER NOT NULL,
  "url" TEXT,
  "summary" JSONB,
  "raw_data" JSONB,
  "import_batch_id" TEXT,
  "source_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dapodik_cities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dapodik_districts" (
  "id" SERIAL NOT NULL,
  "semester_id" TEXT,
  "kode_wilayah" TEXT NOT NULL,
  "province_kode_wilayah" TEXT,
  "city_kode_wilayah" TEXT,
  "name" TEXT NOT NULL,
  "province_name" TEXT,
  "city_name" TEXT,
  "id_level_wilayah" INTEGER NOT NULL,
  "url" TEXT,
  "summary" JSONB,
  "raw_data" JSONB,
  "import_batch_id" TEXT,
  "source_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dapodik_districts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_dapodik_links" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "dapodik_school_id" INTEGER NOT NULL,
  "linked_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_dapodik_links_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "dapodik_schools"
  ADD COLUMN "bp" TEXT,
  ADD COLUMN "bentuk_pendidikan" TEXT,
  ADD COLUMN "province_kode_wilayah" TEXT,
  ADD COLUMN "city_kode_wilayah" TEXT,
  ADD COLUMN "district_kode_wilayah" TEXT,
  ADD COLUMN "import_batch_id" TEXT,
  ADD COLUMN "source_hash" TEXT;

CREATE UNIQUE INDEX "dapodik_provinces_kode_wilayah_key" ON "dapodik_provinces" ("kode_wilayah");
CREATE UNIQUE INDEX "dapodik_cities_kode_wilayah_key" ON "dapodik_cities" ("kode_wilayah");
CREATE UNIQUE INDEX "dapodik_districts_kode_wilayah_key" ON "dapodik_districts" ("kode_wilayah");
CREATE UNIQUE INDEX "school_dapodik_links_school_id_key" ON "school_dapodik_links" ("school_id");
CREATE UNIQUE INDEX "school_dapodik_links_dapodik_school_id_key" ON "school_dapodik_links" ("dapodik_school_id");

CREATE INDEX "idx_dapodik_provinces_semester" ON "dapodik_provinces" ("semester_id");
CREATE INDEX "idx_dapodik_cities_semester" ON "dapodik_cities" ("semester_id");
CREATE INDEX "idx_dapodik_cities_province_kode" ON "dapodik_cities" ("province_kode_wilayah");
CREATE INDEX "idx_dapodik_districts_semester" ON "dapodik_districts" ("semester_id");
CREATE INDEX "idx_dapodik_districts_province_kode" ON "dapodik_districts" ("province_kode_wilayah");
CREATE INDEX "idx_dapodik_districts_city_kode" ON "dapodik_districts" ("city_kode_wilayah");
CREATE INDEX "idx_school_dapodik_links_linked_by" ON "school_dapodik_links" ("linked_by");
CREATE INDEX "idx_dapodik_schools_province_kode" ON "dapodik_schools" ("province_kode_wilayah");
CREATE INDEX "idx_dapodik_schools_city_kode" ON "dapodik_schools" ("city_kode_wilayah");
CREATE INDEX "idx_dapodik_schools_district_kode" ON "dapodik_schools" ("district_kode_wilayah");
CREATE INDEX "idx_dapodik_schools_import_batch" ON "dapodik_schools" ("import_batch_id");

ALTER TABLE "dapodik_cities"
  ADD CONSTRAINT "dapodik_cities_province_kode_wilayah_fkey"
    FOREIGN KEY ("province_kode_wilayah") REFERENCES "dapodik_provinces"("kode_wilayah")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dapodik_districts"
  ADD CONSTRAINT "dapodik_districts_province_kode_wilayah_fkey"
    FOREIGN KEY ("province_kode_wilayah") REFERENCES "dapodik_provinces"("kode_wilayah")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "dapodik_districts_city_kode_wilayah_fkey"
    FOREIGN KEY ("city_kode_wilayah") REFERENCES "dapodik_cities"("kode_wilayah")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dapodik_schools"
  ADD CONSTRAINT "dapodik_schools_district_kode_wilayah_fkey"
    FOREIGN KEY ("district_kode_wilayah") REFERENCES "dapodik_districts"("kode_wilayah")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school_dapodik_links"
  ADD CONSTRAINT "school_dapodik_links_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "school_dapodik_links_dapodik_school_id_fkey"
    FOREIGN KEY ("dapodik_school_id") REFERENCES "dapodik_schools"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
