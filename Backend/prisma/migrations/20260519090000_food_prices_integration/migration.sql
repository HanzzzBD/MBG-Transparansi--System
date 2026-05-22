-- Food price references imported from SP2KP Kemendag.
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

CREATE UNIQUE INDEX IF NOT EXISTS "food_prices_date_scope_province_city_variant_key"
  ON "food_prices" ("date", "scope", "province_code", "city_code", "variant_id");

CREATE INDEX IF NOT EXISTS "idx_food_prices_date" ON "food_prices" ("date");
CREATE INDEX IF NOT EXISTS "idx_food_prices_province" ON "food_prices" ("province");
CREATE INDEX IF NOT EXISTS "idx_food_prices_city" ON "food_prices" ("city");
CREATE INDEX IF NOT EXISTS "idx_food_prices_variant" ON "food_prices" ("variant");
CREATE INDEX IF NOT EXISTS "idx_food_prices_scope" ON "food_prices" ("scope");
CREATE INDEX IF NOT EXISTS "idx_food_prices_variant_id" ON "food_prices" ("variant_id");

ALTER TABLE "price_thresholds"
  ADD COLUMN IF NOT EXISTS "avg_reference_price" NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_from_food_prices" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMP(3);
