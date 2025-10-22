-- CreateTable
CREATE TABLE "message" (
    "message_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,

    CONSTRAINT "message_pkey" PRIMARY KEY ("message_id"),

    CONSTRAINT "chk_sender_receiver" CHECK ("sender_id" <> "receiver_id")
);

-- CreateTable
CREATE TABLE "message_media" (
    "media_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_url" TEXT NOT NULL,
    "message_id" UUID NOT NULL,

    CONSTRAINT "message_media_pkey" PRIMARY KEY ("media_id")
);

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "message"("message_id") ON DELETE CASCADE ON UPDATE NO ACTION;
