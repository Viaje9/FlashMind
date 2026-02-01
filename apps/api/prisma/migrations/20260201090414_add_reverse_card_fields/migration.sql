-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "reverseDifficulty" DOUBLE PRECISION,
ADD COLUMN     "reverseDue" TIMESTAMP(3),
ADD COLUMN     "reverseElapsedDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reverseLapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reverseLastReview" TIMESTAMP(3),
ADD COLUMN     "reverseReps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reverseScheduledDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reverseStability" DOUBLE PRECISION,
ADD COLUMN     "reverseState" "CardState" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "enableReverse" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'FORWARD';
