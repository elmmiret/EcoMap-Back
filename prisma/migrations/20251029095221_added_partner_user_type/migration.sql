/*
  Warnings:

  - Made the column `points` on table `client` required. This step will fail if there are existing NULL values in that column.
  - Made the column `streak` on table `client` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "client" ALTER COLUMN "points" SET NOT NULL,
ALTER COLUMN "streak" SET NOT NULL;

-- CreateTable
CREATE TABLE "partner" (
    "user_id" TEXT NOT NULL,

    CONSTRAINT "partner_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "partner" ADD CONSTRAINT "partner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
