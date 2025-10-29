/*
  Warnings:

  - Added the required column `equipment_type` to the `recycling_point` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "equipment_type" AS ENUM ('Recycling Center', 'Batteries', 'Medicines and Packaging', 'Garden Waste', 'Clothing and Footwear', 'Bulky Waste', 'Glass Containers', 'Coffee Capsules', 'Used Cooking Oil', 'Household Construction Waste', 'Community Composting');

-- AlterTable
ALTER TABLE "client" ALTER COLUMN "phone" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "recycling_point" DROP COLUMN "equipment_type",
ADD COLUMN     "equipment_type" "equipment_type" NOT NULL;

-- CreateIndex
CREATE INDEX "recycling_point_api_location_equipment_type_idx" ON "recycling_point"("api_location", "equipment_type");
