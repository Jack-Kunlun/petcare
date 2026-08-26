-- CreateTable
CREATE TABLE "community_post_reports" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "community_post_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_post_reports_post_id_status_created_at_idx" ON "community_post_reports"("post_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "community_post_reports_reporter_id_created_at_idx" ON "community_post_reports"("reporter_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "community_post_reports_post_id_reporter_id_key" ON "community_post_reports"("post_id", "reporter_id");

-- AddForeignKey
ALTER TABLE "community_post_reports" ADD CONSTRAINT "community_post_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_reports" ADD CONSTRAINT "community_post_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
