/*
  Warnings:

  - Added the required column `valoration_target` to the `valoration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "valoration" ADD COLUMN     "valoration_target" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "valoration_valoration_target_idx" ON "valoration"("valoration_target");

-- AddForeignKey
ALTER TABLE "valoration" ADD CONSTRAINT "valoration_valoration_target_fkey" FOREIGN KEY ("valoration_target") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
