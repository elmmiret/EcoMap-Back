/*
  Warnings:

  - A unique constraint covering the columns `[api_location,api_id]` on the table `recycling_point` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `recycling_point` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `recycling_point` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "cache_status" AS ENUM ('SYNCING', 'READY', 'ERROR');

-- AlterTable
ALTER TABLE "recycling_point" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "equipment_type" TEXT,
ADD COLUMN     "last_updated" TIMESTAMP(3),
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "raw_payload" JSONB,
ADD COLUMN     "schedule" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "cache_metadata" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "last_sync" TIMESTAMP(3),
    "next_sync" TIMESTAMP(3),
    "status" "cache_status" NOT NULL DEFAULT 'READY',
    "error_message" TEXT,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cache_metadata_source_key" ON "cache_metadata"("source");

-- CreateIndex
CREATE INDEX "recycling_point_api_location_idx" ON "recycling_point"("api_location");

-- CreateIndex
CREATE INDEX "recycling_point_api_location_api_id_idx" ON "recycling_point"("api_location", "api_id");

-- CreateIndex
CREATE INDEX "recycling_point_api_location_name_idx" ON "recycling_point"("api_location", "name");

-- CreateIndex
CREATE INDEX "recycling_point_api_location_latitude_longitude_idx" ON "recycling_point"("api_location", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "recycling_point_api_location_equipment_type_idx" ON "recycling_point"("api_location", "equipment_type");

-- CreateIndex
CREATE UNIQUE INDEX "recycling_point_api_location_api_id_key" ON "recycling_point"("api_location", "api_id");
