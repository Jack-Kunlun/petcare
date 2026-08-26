-- DropIndex
DROP INDEX "comments_post_id_idx";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "moderation_reason" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'published';

-- CreateIndex
CREATE INDEX "comments_post_id_status_created_at_idx" ON "comments"("post_id", "status", "created_at");
