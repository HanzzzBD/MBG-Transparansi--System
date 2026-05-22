ALTER TYPE "AnomalyType" ADD VALUE IF NOT EXISTS 'RAW_MATERIAL_PRICE_ANOMALY';

CREATE TABLE IF NOT EXISTS "production_batches" (
  "id" SERIAL PRIMARY KEY,
  "sppg_id" INTEGER NOT NULL,
  "menu_id" INTEGER,
  "production_date" DATE NOT NULL,
  "total_portions" INTEGER NOT NULL,
  "raw_material_cost" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "operational_cost" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "packaging_cost" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "distribution_cost" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "total_cost" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "cost_per_portion" NUMERIC(10, 2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_batches_sppg_id_fkey"
    FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "production_batches_menu_id_fkey"
    FOREIGN KEY ("menu_id") REFERENCES "menus"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "production_batch_items" (
  "id" SERIAL PRIMARY KEY,
  "production_batch_id" INTEGER NOT NULL,
  "commodity_name" TEXT NOT NULL,
  "variant_id" INTEGER,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "unit_price" NUMERIC(12, 2) NOT NULL,
  "total_price" NUMERIC(14, 2) NOT NULL,
  "source_price" TEXT,
  "source_price_id" INTEGER,
  "market_reference_price" NUMERIC(12, 2),
  "price_difference_percent" NUMERIC(8, 2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_batch_items_production_batch_id_fkey"
    FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "production_batch_items_source_price_id_fkey"
    FOREIGN KEY ("source_price_id") REFERENCES "food_prices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_production_batches_sppg_date"
  ON "production_batches" ("sppg_id", "production_date");
CREATE INDEX IF NOT EXISTS "idx_production_batches_menu"
  ON "production_batches" ("menu_id");
CREATE INDEX IF NOT EXISTS "idx_production_batch_items_batch"
  ON "production_batch_items" ("production_batch_id");
CREATE INDEX IF NOT EXISTS "idx_production_batch_items_variant"
  ON "production_batch_items" ("variant_id");
CREATE INDEX IF NOT EXISTS "idx_production_batch_items_source_price"
  ON "production_batch_items" ("source_price_id");

ALTER TABLE "distributions"
  ADD COLUMN IF NOT EXISTS "production_batch_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'distributions_production_batch_id_fkey'
  ) THEN
    ALTER TABLE "distributions"
      ADD CONSTRAINT "distributions_production_batch_id_fkey"
      FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_distributions_production_batch"
  ON "distributions" ("production_batch_id");

ALTER TABLE "anomaly_logs"
  ALTER COLUMN "distribution_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "production_batch_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "production_batch_item_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anomaly_logs_production_batch_id_fkey'
  ) THEN
    ALTER TABLE "anomaly_logs"
      ADD CONSTRAINT "anomaly_logs_production_batch_id_fkey"
      FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anomaly_logs_production_batch_item_id_fkey'
  ) THEN
    ALTER TABLE "anomaly_logs"
      ADD CONSTRAINT "anomaly_logs_production_batch_item_id_fkey"
      FOREIGN KEY ("production_batch_item_id") REFERENCES "production_batch_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_anomaly_logs_production_batch"
  ON "anomaly_logs" ("production_batch_id");
CREATE INDEX IF NOT EXISTS "idx_anomaly_logs_production_batch_item"
  ON "anomaly_logs" ("production_batch_item_id");
