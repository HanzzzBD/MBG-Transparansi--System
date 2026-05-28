ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'gov';

DO $$
BEGIN
  CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "group" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" SERIAL PRIMARY KEY,
  "role" "UserRole" NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_permissions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "granted_by" INTEGER,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_granted_by_fkey"
    FOREIGN KEY ("granted_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key"
  ON "permissions"("key");

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_permission_id_key"
  ON "role_permissions"("role", "permission_id");

CREATE INDEX IF NOT EXISTS "idx_role_permissions_role"
  ON "role_permissions"("role");

CREATE INDEX IF NOT EXISTS "idx_role_permissions_permission"
  ON "role_permissions"("permission_id");

CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_user_permission_id_key"
  ON "user_permissions"("user_id", "permission_id");

CREATE INDEX IF NOT EXISTS "idx_user_permissions_user"
  ON "user_permissions"("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_permissions_permission"
  ON "user_permissions"("permission_id");

CREATE INDEX IF NOT EXISTS "idx_user_permissions_granted_by"
  ON "user_permissions"("granted_by");
