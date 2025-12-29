-- CreateEnum
CREATE TYPE "report_reason_type" AS ENUM ('inappropriate_content', 'harassment', 'fake_profile', 'spam', 'other');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('Pending', 'Reviewed', 'Resolved', 'Dismissed');

-- CreateTable
CREATE TABLE "user_report" (
    "report_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" TEXT NOT NULL,
    "reported_user_id" TEXT NOT NULL,
    "reason" "report_reason_type" NOT NULL,
    "description" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_report_pkey" PRIMARY KEY ("report_id")
);

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
