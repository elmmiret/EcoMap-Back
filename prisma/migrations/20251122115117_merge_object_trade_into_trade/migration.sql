/*
  Warnings:

  - You are about to drop the `object_trade` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `item_state` to the `trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `points_price` to the `trade` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."object_trade" DROP CONSTRAINT "object_trade_publication_id_fkey";

-- AlterTable
ALTER TABLE "trade" ADD COLUMN     "item_state" "item_state_type" NOT NULL,
ADD COLUMN     "points_price" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."object_trade";
