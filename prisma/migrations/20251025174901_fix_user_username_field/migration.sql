/*
  Warnings:

  - Added the required column `username` to the `registered_user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "registered_user" ADD COLUMN     "username" TEXT NOT NULL;
