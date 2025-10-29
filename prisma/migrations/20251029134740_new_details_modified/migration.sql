/*
  Warnings:

  - The values [CollectionServices,ContainerStates,RecyclingEvents,NewRewards,NewTrade,NewMessage] on the enum `notification_type` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `latitude` on table `recycling_point` required. This step will fail if there are existing NULL values in that column.
  - Made the column `longitude` on table `recycling_point` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "notification_type_new" AS ENUM ('Collection Services', 'Container States', 'Recycling Events', 'New Rewards', 'New Trade', 'New Message', 'Incidences');
ALTER TABLE "notification" ALTER COLUMN "notification_type" TYPE "notification_type_new" USING ("notification_type"::text::"notification_type_new");
ALTER TYPE "notification_type" RENAME TO "notification_type_old";
ALTER TYPE "notification_type_new" RENAME TO "notification_type";
DROP TYPE "public"."notification_type_old";
COMMIT;

-- AlterTable
ALTER TABLE "recycling_point" ALTER COLUMN "latitude" SET NOT NULL,
ALTER COLUMN "longitude" SET NOT NULL;
