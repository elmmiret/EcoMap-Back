-- CreateEnum
CREATE TYPE "item_state_type" AS ENUM ('New', 'Little used', 'Widely used', 'Bad condition');

-- CreateEnum
CREATE TYPE "state_type" AS ENUM ('Completed', 'Cancelled', 'Pending');

-- CreateTable
CREATE TABLE "object_trade" (
    "publication_id" UUID NOT NULL,
    "item_state" "item_state_type" NOT NULL,
    "points_price" INTEGER,

    CONSTRAINT "object_trade_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "publication" (
    "publication_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "publication_state" "state_type" NOT NULL,

    CONSTRAINT "publication_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "publication_media" (
    "media_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_url" TEXT NOT NULL,
    "publication_id" UUID NOT NULL,

    CONSTRAINT "publication_media_pkey" PRIMARY KEY ("media_id")
);

-- CreateTable
CREATE TABLE "reward" (
    "publication_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "points_price" INTEGER NOT NULL,

    CONSTRAINT "reward_pkey" PRIMARY KEY ("publication_id")
);

-- AddForeignKey
ALTER TABLE "object_trade" ADD CONSTRAINT "object_trade_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("publication_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("publication_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("publication_id") ON DELETE CASCADE ON UPDATE NO ACTION;
