/*
  Warnings:

  - Made the column `total_cost` on table `distributions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "anomaly_logs" DROP CONSTRAINT "anomaly_logs_resolved_by_fkey";

-- AlterTable
ALTER TABLE "distributions" ALTER COLUMN "total_cost" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exports" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "issues" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "menus" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "price_thresholds" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "schools" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sppg" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "system_configs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "validations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "anomaly_logs" ADD CONSTRAINT "anomaly_logs_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
