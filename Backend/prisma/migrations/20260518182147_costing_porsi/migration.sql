-- AlterTable
ALTER TABLE "food_prices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "production_batch_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "production_batches" ALTER COLUMN "updated_at" DROP DEFAULT;
