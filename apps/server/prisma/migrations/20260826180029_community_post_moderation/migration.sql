-- CreateTable
CREATE TABLE "community_post_moderation_events" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_status" TEXT NOT NULL,
    "next_status" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_post_moderation_events_post_id_created_at_idx" ON "community_post_moderation_events"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "community_post_moderation_events_operator_id_created_at_idx" ON "community_post_moderation_events"("operator_id", "created_at");

-- AddForeignKey
ALTER TABLE "community_post_moderation_events" ADD CONSTRAINT "community_post_moderation_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_moderation_events" ADD CONSTRAINT "community_post_moderation_events_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
