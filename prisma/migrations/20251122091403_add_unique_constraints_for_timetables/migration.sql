/*
  Warnings:

  - A unique constraint covering the columns `[open_time,end_time]` on the table `time_interval` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[recycling_point_id,week_day]` on the table `timetable` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "time_interval_open_time_end_time_key" ON "time_interval"("open_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_recycling_point_id_week_day_key" ON "timetable"("recycling_point_id", "week_day");
