-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "learningStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reverseLearningStep" INTEGER NOT NULL DEFAULT 0;
