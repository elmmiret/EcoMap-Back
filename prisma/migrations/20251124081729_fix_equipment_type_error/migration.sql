-- CreateTable
CREATE TABLE "saved_recycling_point" (
    "user_id" TEXT NOT NULL,
    "recycling_point_id" UUID NOT NULL,

    CONSTRAINT "saved_recycling_point_pkey" PRIMARY KEY ("user_id","recycling_point_id")
);

-- CreateIndex
CREATE INDEX "saved_recycling_point_user_id_idx" ON "saved_recycling_point"("user_id");

-- AddForeignKey
ALTER TABLE "saved_recycling_point" ADD CONSTRAINT "saved_recycling_point_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "saved_recycling_point" ADD CONSTRAINT "saved_recycling_point_recycling_point_id_fkey" FOREIGN KEY ("recycling_point_id") REFERENCES "recycling_point"("recycling_point_id") ON DELETE CASCADE ON UPDATE NO ACTION;
