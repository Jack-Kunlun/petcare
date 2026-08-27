-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "species" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN     "taboo_foods" TEXT,
ALTER COLUMN "age" DROP NOT NULL,
ALTER COLUMN "gender" SET DEFAULT 'unknown';
