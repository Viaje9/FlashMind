-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "overrideDate" TIMESTAMP(3),
ADD COLUMN     "overrideNewCards" INTEGER,
ADD COLUMN     "overrideReviewCards" INTEGER;
