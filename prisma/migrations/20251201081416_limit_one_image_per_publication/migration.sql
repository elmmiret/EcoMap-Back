/*
  Warnings:

  - A unique constraint covering the columns `[publication_id]` on the table `publication_media` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "publication_media_publication_id_key" ON "publication_media"("publication_id");
