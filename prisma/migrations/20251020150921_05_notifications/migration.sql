-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('CollectionServices', 'ContainerStates', 'RecyclingEvents', 'NewRewards', 'NewTrade', 'NewMessage', 'Incidences');

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "notification_type" "notification_type" NOT NULL,
    "content" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX idx_notification_undelivered ON notification ("delivered") WHERE "delivered" = FALSE;