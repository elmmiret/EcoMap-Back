/*
  Warnings:

  - The values [Glass,Paper,Plastic,Organic,General waste,Textile,Electronics,Batteries,Oil,Hazardous] on the enum `product_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "product_type_new" AS ENUM ('ElectricContainer', 'GlassContainer', 'OrganicContainer', 'PaperContainer', 'PlasticContainer', 'TextileContainer', 'Unrecyclable');
ALTER TABLE "container" ALTER COLUMN "type" TYPE "product_type_new" USING ("type"::text::"product_type_new");
ALTER TYPE "product_type" RENAME TO "product_type_old";
ALTER TYPE "product_type_new" RENAME TO "product_type";
DROP TYPE "public"."product_type_old";
COMMIT;
