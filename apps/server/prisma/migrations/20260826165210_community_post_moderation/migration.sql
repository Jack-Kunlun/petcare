-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "moderation_reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';
