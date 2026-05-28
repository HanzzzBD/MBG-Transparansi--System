DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MenuPriceValidationStatus') THEN
    CREATE TYPE "MenuPriceValidationStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'MISMATCH');
  END IF;
END $$;

ALTER TYPE "DistributionStatus" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "DistributionStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "DistributionStatus" ADD VALUE IF NOT EXISTS 'sent';

ALTER TABLE "menus"
  ADD COLUMN IF NOT EXISTS "items" JSONB,
  ADD COLUMN IF NOT EXISTS "photo_file_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "manual_price_per_portion" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "price_validation_status" "MenuPriceValidationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS "price_validation_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "price_validated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "price_validated_by" INTEGER;

ALTER TABLE "distributions"
  ADD COLUMN IF NOT EXISTS "menu_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menus_photo_file_id_fkey'
  ) THEN
    ALTER TABLE "menus"
      ADD CONSTRAINT "menus_photo_file_id_fkey"
      FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menus_price_validated_by_fkey'
  ) THEN
    ALTER TABLE "menus"
      ADD CONSTRAINT "menus_price_validated_by_fkey"
      FOREIGN KEY ("price_validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'distributions_menu_id_fkey'
  ) THEN
    ALTER TABLE "distributions"
      ADD CONSTRAINT "distributions_menu_id_fkey"
      FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_menus_photo_file" ON "menus"("photo_file_id");
CREATE INDEX IF NOT EXISTS "idx_menus_price_validation_status" ON "menus"("price_validation_status");
CREATE INDEX IF NOT EXISTS "idx_distributions_menu" ON "distributions"("menu_id");
CREATE INDEX IF NOT EXISTS "idx_distributions_sent_at" ON "distributions"("sent_at");
