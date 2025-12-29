/*
  Warnings:

  - The values [Reviewed] on the enum `report_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "report_status_new" AS ENUM ('Pending', 'Resolved', 'Dismissed');
ALTER TABLE "public"."user_report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "user_report" ALTER COLUMN "status" TYPE "report_status_new" USING ("status"::text::"report_status_new");
ALTER TYPE "report_status" RENAME TO "report_status_old";
ALTER TYPE "report_status_new" RENAME TO "report_status";
DROP TYPE "public"."report_status_old";
ALTER TABLE "user_report" ALTER COLUMN "status" SET DEFAULT 'Pending';
COMMIT;
