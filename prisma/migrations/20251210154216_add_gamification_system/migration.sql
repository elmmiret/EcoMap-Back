-- CreateEnum
CREATE TYPE "point_source" AS ENUM ('ECO_TRADER_SALE', 'RECYCLING_ACTION', 'EVENT_ATTENDANCE', 'REWARD_REDEMPTION', 'ADMIN_ADJUSTMENT');

-- AlterTable
ALTER TABLE "client" ALTER COLUMN "points" SET DEFAULT 0,
ALTER COLUMN "streak" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "point_history" (
    "history_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "point_source" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE INDEX "point_history_user_id_idx" ON "point_history"("user_id");

-- AddForeignKey
ALTER TABLE "point_history" ADD CONSTRAINT "point_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
