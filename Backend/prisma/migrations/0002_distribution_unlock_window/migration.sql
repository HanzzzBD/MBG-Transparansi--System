ALTER TABLE "distributions"
  ADD COLUMN "unlocked_until" TIMESTAMP(3);

CREATE INDEX "idx_distributions_unlocked_until" ON "distributions" ("unlocked_until");
