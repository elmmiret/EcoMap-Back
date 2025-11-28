/*
  Warnings:

  - You are about to drop the column `read` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `receiver_id` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `sent_at` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `message` table. All the data in the column will be lost.
  - Added the required column `chat_id` to the `message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."message" DROP CONSTRAINT "message_receiver_id_fkey";

-- AlterTable
ALTER TABLE "message" DROP COLUMN "read",
DROP COLUMN "receiver_id",
DROP COLUMN "sent_at",
DROP COLUMN "text",
ADD COLUMN     "chat_id" UUID NOT NULL,
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "delivered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "chat" (
    "chat_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user1_id" TEXT NOT NULL,
    "user2_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_pkey" PRIMARY KEY ("chat_id")
);

-- CreateTable
CREATE TABLE "device_token" (
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_token_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "chat_user1_id_idx" ON "chat"("user1_id");

-- CreateIndex
CREATE INDEX "chat_user2_id_idx" ON "chat"("user2_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_user1_id_user2_id_key" ON "chat"("user1_id", "user2_id");

-- CreateIndex
CREATE INDEX "device_token_user_id_idx" ON "device_token"("user_id");

-- CreateIndex
CREATE INDEX "message_chat_id_idx" ON "message"("chat_id");

-- CreateIndex
CREATE INDEX "message_sender_id_idx" ON "message"("sender_id");

-- CreateIndex
CREATE INDEX "message_chat_id_is_read_idx" ON "message"("chat_id", "is_read");

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chat"("chat_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "device_token" ADD CONSTRAINT "device_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
