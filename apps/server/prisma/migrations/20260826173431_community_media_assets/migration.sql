-- CreateTable
CREATE TABLE "community_media_assets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "post_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_media_assets_storage_key_key" ON "community_media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "community_media_assets_owner_id_status_created_at_idx" ON "community_media_assets"("owner_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "community_media_assets_post_id_idx" ON "community_media_assets"("post_id");

-- CreateIndex
CREATE INDEX "community_media_assets_checksum_idx" ON "community_media_assets"("checksum");

-- AddForeignKey
ALTER TABLE "community_media_assets" ADD CONSTRAINT "community_media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_media_assets" ADD CONSTRAINT "community_media_assets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
