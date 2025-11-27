-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reservation_ended" (
    "reservation_id" UUID NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_ended_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "valoration" (
    "valoration_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "reservation_id" UUID NOT NULL,
    "valoration_owner" TEXT NOT NULL,

    CONSTRAINT "valoration_pkey" PRIMARY KEY ("valoration_id")
);

-- CreateIndex
CREATE INDEX "valoration_reservation_id_idx" ON "valoration"("reservation_id");

-- CreateIndex
CREATE INDEX "valoration_valoration_owner_idx" ON "valoration"("valoration_owner");

-- AddForeignKey
ALTER TABLE "reservation_ended" ADD CONSTRAINT "reservation_ended_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("reservation_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "valoration" ADD CONSTRAINT "valoration_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation_ended"("reservation_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "valoration" ADD CONSTRAINT "valoration_valoration_owner_fkey" FOREIGN KEY ("valoration_owner") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
