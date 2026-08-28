-- AlterTable
ALTER TABLE "pets" DROP COLUMN "allergies",
DROP COLUMN "habits",
DROP COLUMN "taboo_foods",
ADD COLUMN     "notes" TEXT;
