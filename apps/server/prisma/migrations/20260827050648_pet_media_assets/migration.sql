-- CreateTable
CREATE TABLE "pet_media_assets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "pet_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "discarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pet_media_assets_storage_key_key" ON "pet_media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "pet_media_assets_owner_id_status_created_at_idx" ON "pet_media_assets"("owner_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "pet_media_assets_pet_id_status_created_at_idx" ON "pet_media_assets"("pet_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "pet_media_assets_checksum_idx" ON "pet_media_assets"("checksum");

-- AddForeignKey
ALTER TABLE "pet_media_assets" ADD CONSTRAINT "pet_media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_media_assets" ADD CONSTRAINT "pet_media_assets_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
