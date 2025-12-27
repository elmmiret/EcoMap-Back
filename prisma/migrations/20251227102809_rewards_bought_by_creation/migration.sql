-- CreateTable
CREATE TABLE "reward_bought_by" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" TEXT NOT NULL,
    "reward_id" UUID NOT NULL,
    "bought_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_cost" INTEGER NOT NULL,

    CONSTRAINT "reward_bought_by_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reward_bought_by" ADD CONSTRAINT "reward_bought_by_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reward_bought_by" ADD CONSTRAINT "reward_bought_by_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "reward"("publication_id") ON DELETE CASCADE ON UPDATE NO ACTION;
