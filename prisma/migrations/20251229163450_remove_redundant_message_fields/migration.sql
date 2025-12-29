/*
  Warnings:

  - You are about to drop the column `delivered` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `is_read` on the `message` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "message_chat_id_is_read_idx";

-- AlterTable
ALTER TABLE "message" DROP COLUMN "delivered",
DROP COLUMN "is_read";
