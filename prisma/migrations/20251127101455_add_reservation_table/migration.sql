-- CreateTable
CREATE TABLE "reservation" (
    "reservation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trade_id" UUID NOT NULL,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateIndex
CREATE INDEX "reservation_trade_id_idx" ON "reservation"("trade_id");

-- CreateIndex
CREATE INDEX "reservation_client_id_idx" ON "reservation"("client_id");

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trade"("trade_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;
