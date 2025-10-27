-- CreateTable
CREATE TABLE "session" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jwt" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_jwt_key" ON "session"("jwt");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "registered_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
