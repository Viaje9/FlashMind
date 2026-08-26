CREATE TYPE "TargetVocabularyStatus" AS ENUM ('UNSEEN', 'PRACTICING', 'USED', 'ADDED');

CREATE TABLE "TargetVocabulary" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "normalizedTerm" TEXT NOT NULL,
  "zhMeaning" TEXT NOT NULL,
  "status" "TargetVocabularyStatus" NOT NULL DEFAULT 'UNSEEN',
  "recommendationCount" INTEGER NOT NULL DEFAULT 0,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "expressionContext" TEXT,
  "naturalSentence" TEXT,
  "recommendationReason" TEXT,
  "addedCardId" TEXT,
  "addedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TargetVocabulary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TargetVocabulary_userId_normalizedTerm_key"
  ON "TargetVocabulary"("userId", "normalizedTerm");
CREATE INDEX "TargetVocabulary_userId_status_createdAt_idx"
  ON "TargetVocabulary"("userId", "status", "createdAt");
CREATE INDEX "TargetVocabulary_addedCardId_idx" ON "TargetVocabulary"("addedCardId");

ALTER TABLE "TargetVocabulary"
  ADD CONSTRAINT "TargetVocabulary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TargetVocabulary"
  ADD CONSTRAINT "TargetVocabulary_addedCardId_fkey"
  FOREIGN KEY ("addedCardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
