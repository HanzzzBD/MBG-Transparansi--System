-- Add formal workflow status and follow-up fields to public reports.
-- Existing rows remain valid because status receives the default "baru".

CREATE TYPE "PublicReportStatus" AS ENUM ('baru', 'ditinjau', 'ditindak', 'ditutup');

ALTER TABLE "public_reports"
  ADD COLUMN "status" "PublicReportStatus" NOT NULL DEFAULT 'baru',
  ADD COLUMN "follow_up_note" TEXT,
  ADD COLUMN "followed_up_by" INTEGER,
  ADD COLUMN "followed_up_at" TIMESTAMP(3);

ALTER TABLE "public_reports"
  ADD CONSTRAINT "public_reports_followed_up_by_fkey"
  FOREIGN KEY ("followed_up_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_public_reports_status" ON "public_reports"("status");
CREATE INDEX "idx_public_reports_followed_up_by" ON "public_reports"("followed_up_by");
