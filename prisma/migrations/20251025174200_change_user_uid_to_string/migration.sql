/*
  Warnings:

  - The primary key for the `admin` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `client` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `institution` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `registered_user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."admin" DROP CONSTRAINT "admin_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."client" DROP CONSTRAINT "client_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."institution" DROP CONSTRAINT "institution_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."message" DROP CONSTRAINT "message_receiver_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."message" DROP CONSTRAINT "message_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notification" DROP CONSTRAINT "notification_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."registered_user" DROP CONSTRAINT "registered_user_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."session" DROP CONSTRAINT "session_user_id_fkey";

-- AlterTable
ALTER TABLE "admin" DROP CONSTRAINT "admin_pkey",
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "admin_pkey" PRIMARY KEY ("user_id");

-- AlterTable
ALTER TABLE "client" DROP CONSTRAINT "client_pkey",
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "client_pkey" PRIMARY KEY ("user_id");

-- AlterTable
ALTER TABLE "institution" DROP CONSTRAINT "institution_pkey",
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "institution_pkey" PRIMARY KEY ("user_id");

-- AlterTable
ALTER TABLE "message" ALTER COLUMN "sender_id" SET DATA TYPE TEXT,
ALTER COLUMN "receiver_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "notification" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "registered_user" DROP CONSTRAINT "registered_user_pkey",
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "registered_user_pkey" PRIMARY KEY ("user_id");

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "user" DROP CONSTRAINT "user_pkey",
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "user_pkey" PRIMARY KEY ("user_id");

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "institution" ADD CONSTRAINT "institution_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registered_user" ADD CONSTRAINT "registered_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
