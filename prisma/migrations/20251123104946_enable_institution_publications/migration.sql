-- AlterTable
ALTER TABLE "publication" ADD COLUMN     "institution_id" TEXT,
ALTER COLUMN "client_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "publication" ADD CONSTRAINT "publication_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
