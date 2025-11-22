/*
  Warnings:

  - The `equipment_type` column on the `recycling_point` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "equipment_type" AS ENUM ('Recycling Center', 'Batteries', 'Medicines And Packaging', 'Garden Waste', 'Clothing And Footwear', 'Bulky Waste', 'Glass Containers', 'Coffee Capsules', 'Used Cooking Oil', 'Household Construction Waste', 'Community Composting');

-- AlterTable
ALTER TABLE "recycling_point" DROP COLUMN "equipment_type",
ADD COLUMN     "equipment_type" "equipment_type";

-- CreateIndex
CREATE INDEX "recycling_point_api_location_equipment_type_idx" ON "recycling_point"("api_location", "equipment_type");
