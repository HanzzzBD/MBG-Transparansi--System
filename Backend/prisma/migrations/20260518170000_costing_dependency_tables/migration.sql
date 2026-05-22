-- Repair migration order for Prisma shadow database.
-- The later 20260518182147_costing_porsi migration alters these tables, so
-- fresh shadow databases need them before that migration runs.

CREATE TABLE IF NOT EXISTS "food_prices" (
  "id" SERIAL PRIMARY KEY,
  "date" DATE NOT NULL,
  "source" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "level" TEXT,
  "province_code" TEXT,
  "province" TEXT,
  "city_code" TEXT,
  "city" TEXT,
  "variant_id" INTEGER NOT NULL,
  "variant" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "price" NUMERIC(12, 2) NOT NULL,
  "source_endpoint" TEXT,
  "raw_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
