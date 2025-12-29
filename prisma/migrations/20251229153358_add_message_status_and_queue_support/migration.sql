/*
  Warnings:

  - Added the required column `updated_at` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable: Add new columns with defaults
ALTER TABLE "message" ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "message_status" NOT NULL DEFAULT 'SENT',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing messages: set status based on current state
UPDATE "message" SET 
  "status" = CASE 
    WHEN "is_read" = true THEN 'READ'::message_status
    WHEN "delivered" = true THEN 'DELIVERED'::message_status
    ELSE 'SENT'::message_status
  END,
  "updated_at" = "created_at";

-- CreateIndex
CREATE INDEX "message_status_idx" ON "message"("status");
