ALTER TYPE "ValidationStatus" ADD VALUE IF NOT EXISTS 'issue_reported';

ALTER TABLE "school_reports"
  ADD COLUMN IF NOT EXISTS "sppg_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "distribution_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_reports_sppg_id_fkey'
  ) THEN
    ALTER TABLE "school_reports"
      ADD CONSTRAINT "school_reports_sppg_id_fkey"
      FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_reports_distribution_id_fkey'
  ) THEN
    ALTER TABLE "school_reports"
      ADD CONSTRAINT "school_reports_distribution_id_fkey"
      FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_school_reports_sppg" ON "school_reports"("sppg_id");
CREATE INDEX IF NOT EXISTS "idx_school_reports_distribution" ON "school_reports"("distribution_id");
