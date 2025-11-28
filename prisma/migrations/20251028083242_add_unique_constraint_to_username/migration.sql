/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `registered_user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "registered_user_username_key" ON "registered_user"("username");
