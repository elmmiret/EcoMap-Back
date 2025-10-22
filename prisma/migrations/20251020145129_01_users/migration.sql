-- CreateEnum
CREATE TYPE "app_language_type" AS ENUM ('Catalan', 'Spanish', 'English');

-- CreateTable
CREATE TABLE "admin" (
    "user_id" UUID NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "client" (
    "user_id" UUID NOT NULL,
    "address" TEXT,
    "phone" INTEGER,
    "points" INTEGER,
    "birth_date" DATE,
    "description" TEXT,
    "profile_picture" TEXT,
    "streak" INTEGER,

    CONSTRAINT "client_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "institution" (
    "user_id" UUID NOT NULL,

    CONSTRAINT "institution_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "registered_user" (
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT,
    "dni" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "app_language" "app_language_type" NOT NULL,

    CONSTRAINT "registered_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registered_user_email_key" ON "registered_user"("email");

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "institution" ADD CONSTRAINT "institution_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registered_user" ADD CONSTRAINT "registered_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
