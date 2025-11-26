-- CreateTable
CREATE TABLE "trade" (
    "trade_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publication_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_pkey" PRIMARY KEY ("trade_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_publication_id_key" ON "trade"("publication_id");

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("publication_id") ON DELETE CASCADE ON UPDATE NO ACTION;
