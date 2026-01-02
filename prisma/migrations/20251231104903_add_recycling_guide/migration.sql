-- CreateTable
CREATE TABLE "recycling_guide_item" (
    "item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "container_type" "product_type" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recycling_guide_item_pkey" PRIMARY KEY ("item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recycling_guide_item_name_key" ON "recycling_guide_item"("name");

-- CreateIndex
CREATE INDEX "recycling_guide_item_name_idx" ON "recycling_guide_item"("name");
