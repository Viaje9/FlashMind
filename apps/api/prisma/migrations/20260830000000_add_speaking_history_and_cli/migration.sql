-- CreateEnum
CREATE TYPE "SpeakingSource" AS ENUM ('APP', 'LOCAL');

-- AlterTable
ALTER TABLE "TargetVocabulary" ADD COLUMN     "lastExpressionAt" TIMESTAMP(3),
ADD COLUMN     "lastRecommendationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SpeakingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SpeakingSource" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "legacyPracticeContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "translatedText" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'available',
    "hasOriginalAudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingReview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingReviewEvent" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "targetVocabularyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "practicedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "SpeakingReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingLegacySummary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingLegacySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingWriteReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SpeakingSource" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "initialContentHash" TEXT,
    "reviewContentHash" TEXT,
    "reviewId" TEXT,
    "actualUseCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingWriteReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CliLoginAuthorization" (
    "id" TEXT NOT NULL,
    "verifierHash" TEXT NOT NULL,
    "pairingCode" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliLoginAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeakingSession_userId_startedAt_id_idx" ON "SpeakingSession"("userId", "startedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingSession_userId_source_sourceKey_key" ON "SpeakingSession"("userId", "source", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingMessage_sessionId_clientMessageId_key" ON "SpeakingMessage"("sessionId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingMessage_sessionId_ordinal_key" ON "SpeakingMessage"("sessionId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingReview_sessionId_key" ON "SpeakingReview"("sessionId");

-- CreateIndex
CREATE INDEX "SpeakingReviewEvent_targetVocabularyId_practicedAt_idx" ON "SpeakingReviewEvent"("targetVocabularyId", "practicedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingReviewEvent_reviewId_targetVocabularyId_type_key" ON "SpeakingReviewEvent"("reviewId", "targetVocabularyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingLegacySummary_sessionId_clientMessageId_key" ON "SpeakingLegacySummary"("sessionId", "clientMessageId");

-- CreateIndex
CREATE INDEX "SpeakingWriteReceipt_sessionId_idx" ON "SpeakingWriteReceipt"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingWriteReceipt_userId_source_sourceKey_key" ON "SpeakingWriteReceipt"("userId", "source", "sourceKey");

-- CreateIndex
CREATE INDEX "CliLoginAuthorization_expiresAt_idx" ON "CliLoginAuthorization"("expiresAt");

-- AddForeignKey
ALTER TABLE "SpeakingSession" ADD CONSTRAINT "SpeakingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingMessage" ADD CONSTRAINT "SpeakingMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingReview" ADD CONSTRAINT "SpeakingReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingReviewEvent" ADD CONSTRAINT "SpeakingReviewEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "SpeakingReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingReviewEvent" ADD CONSTRAINT "SpeakingReviewEvent_targetVocabularyId_fkey" FOREIGN KEY ("targetVocabularyId") REFERENCES "TargetVocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingLegacySummary" ADD CONSTRAINT "SpeakingLegacySummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingWriteReceipt" ADD CONSTRAINT "SpeakingWriteReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliLoginAuthorization" ADD CONSTRAINT "CliLoginAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
