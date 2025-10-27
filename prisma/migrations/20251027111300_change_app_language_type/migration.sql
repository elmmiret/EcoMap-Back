/*
  Warnings:

  - The values [Catalan,Spanish,English] on the enum `app_language_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "app_language_type_new" AS ENUM ('ca', 'es', 'en');
ALTER TABLE "registered_user" ALTER COLUMN "app_language" TYPE "app_language_type_new" USING ("app_language"::text::"app_language_type_new");
ALTER TYPE "app_language_type" RENAME TO "app_language_type_old";
ALTER TYPE "app_language_type_new" RENAME TO "app_language_type";
DROP TYPE "public"."app_language_type_old";
COMMIT;
