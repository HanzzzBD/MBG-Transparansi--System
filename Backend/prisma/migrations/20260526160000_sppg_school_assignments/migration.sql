CREATE TABLE IF NOT EXISTS "sppg_school_assignments" (
  "id" SERIAL PRIMARY KEY,
  "sppg_id" INTEGER NOT NULL,
  "school_id" INTEGER NOT NULL,
  "assigned_by" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassigned_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sppg_school_assignments_status_check" CHECK ("status" IN ('active', 'inactive')),
  CONSTRAINT "sppg_school_assignments_sppg_id_fkey"
    FOREIGN KEY ("sppg_id") REFERENCES "sppg"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sppg_school_assignments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sppg_school_assignments_assigned_by_fkey"
    FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_sppg_school_assignments_sppg_status"
  ON "sppg_school_assignments" ("sppg_id", "status");

CREATE INDEX IF NOT EXISTS "idx_sppg_school_assignments_school_status"
  ON "sppg_school_assignments" ("school_id", "status");

CREATE INDEX IF NOT EXISTS "idx_sppg_school_assignments_assigned_by"
  ON "sppg_school_assignments" ("assigned_by");

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_sppg_school_assignments_active_pair"
  ON "sppg_school_assignments" ("sppg_id", "school_id")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_sppg_school_assignments_active_school"
  ON "sppg_school_assignments" ("school_id")
  WHERE "status" = 'active';

INSERT INTO "sppg_school_assignments" ("sppg_id", "school_id", "status", "assigned_at", "created_at", "updated_at", "notes")
SELECT s."sppg_id", s."id", 'active', COALESCE(s."created_at", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Backfilled from legacy schools.sppg_id'
FROM "schools" s
WHERE s."deleted_at" IS NULL
  AND s."sppg_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "sppg_school_assignments" a
    WHERE a."school_id" = s."id"
      AND a."status" = 'active'
  );
