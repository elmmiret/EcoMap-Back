-- CreateEnum
CREATE TYPE "api_location" AS ENUM ('Barcelona', 'Navarra');

-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('Glass', 'Paper', 'Plastic', 'Organic', 'General waste', 'Textile', 'Electronics', 'Batteries', 'Oil', 'Hazardous');

-- CreateEnum
CREATE TYPE "week_day" AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');

-- CreateTable
CREATE TABLE "container" (
    "container_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "product_type" NOT NULL,
    "is_full" BOOLEAN NOT NULL,
    "is_damaged" BOOLEAN NOT NULL,
    "recycling_point_id" UUID,

    CONSTRAINT "container_pkey" PRIMARY KEY ("container_id")
);

-- CreateTable
CREATE TABLE "recycling_point" (
    "recycling_point_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_id" INTEGER NOT NULL,
    "api_location" "api_location" NOT NULL,

    CONSTRAINT "recycling_point_pkey" PRIMARY KEY ("recycling_point_id")
);

-- CreateTable
CREATE TABLE "time_interval" (
    "time_interval_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "open_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,

    CONSTRAINT "time_interval_pkey" PRIMARY KEY ("time_interval_id")
);

-- CreateTable
CREATE TABLE "timetable" (
    "timetable_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_day" "week_day" NOT NULL,
    "recycling_point_id" UUID NOT NULL,

    CONSTRAINT "timetable_pkey" PRIMARY KEY ("timetable_id")
);

-- CreateTable
CREATE TABLE "timetable_intervals" (
    "timetable_id" UUID NOT NULL,
    "time_interval_id" UUID NOT NULL,

    CONSTRAINT "timetable_intervals_pkey" PRIMARY KEY ("timetable_id","time_interval_id")
);

-- AddForeignKey
ALTER TABLE "container" ADD CONSTRAINT "container_recycling_point_id_fkey" FOREIGN KEY ("recycling_point_id") REFERENCES "recycling_point"("recycling_point_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timetable" ADD CONSTRAINT "timetable_recycling_point_id_fkey" FOREIGN KEY ("recycling_point_id") REFERENCES "recycling_point"("recycling_point_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timetable_intervals" ADD CONSTRAINT "timetable_intervals_time_interval_id_fkey" FOREIGN KEY ("time_interval_id") REFERENCES "time_interval"("time_interval_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timetable_intervals" ADD CONSTRAINT "timetable_intervals_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE CASCADE ON UPDATE NO ACTION;
