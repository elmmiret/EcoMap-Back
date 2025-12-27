/*
  Warnings:

  - You are about to drop the column `profile_picture` on the `client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "client" DROP COLUMN "profile_picture";

-- AlterTable
ALTER TABLE "registered_user" ADD COLUMN     "profile_picture" TEXT;
