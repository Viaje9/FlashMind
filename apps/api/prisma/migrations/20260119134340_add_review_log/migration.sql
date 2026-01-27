-- CreateEnum
CREATE TYPE "StudyRating" AS ENUM ('KNOWN', 'UNFAMILIAR', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rating" "StudyRating" NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevState" "CardState" NOT NULL,
    "prevStability" DOUBLE PRECISION,
    "prevDifficulty" DOUBLE PRECISION,
    "newState" "CardState" NOT NULL,
    "newStability" DOUBLE PRECISION,
    "newDifficulty" DOUBLE PRECISION,
    "scheduledDays" INTEGER NOT NULL,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
