-- DropIndex
DROP INDEX "trade_created_at_idx";

-- AlterTable
ALTER TABLE "registered_user" ADD COLUMN     "blocked_users" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "trade_created_at_idx" ON "trade"("created_at" DESC);
