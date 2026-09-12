-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "provider_qualification_uploads" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_qualification_uploads_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "provider_qualification_uploads_created_at_idx" ON "provider_qualification_uploads"("created_at");
