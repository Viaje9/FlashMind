-- CreateEnum
CREATE TYPE "TopicConversationRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "TopicConversationCorrectionStatus" AS ENUM ('CORRECT', 'IMPROVED', 'CORRECTED');

-- CreateTable
CREATE TABLE "TopicConversationTopic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicConversationTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicConversationSession" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicConversationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "TopicConversationRole" NOT NULL,
    "content" TEXT NOT NULL,
    "correctionStatus" "TopicConversationCorrectionStatus",
    "correctedText" TEXT,
    "correctionExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicConversationTopic_userId_normalizedTitle_key" ON "TopicConversationTopic"("userId", "normalizedTitle");

-- CreateIndex
CREATE INDEX "TopicConversationTopic_userId_createdAt_idx" ON "TopicConversationTopic"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TopicConversationSession_topicId_updatedAt_idx" ON "TopicConversationSession"("topicId", "updatedAt");

-- CreateIndex
CREATE INDEX "TopicConversationSession_updatedAt_idx" ON "TopicConversationSession"("updatedAt");

-- CreateIndex
CREATE INDEX "TopicConversationMessage_sessionId_createdAt_idx" ON "TopicConversationMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "TopicConversationTopic" ADD CONSTRAINT "TopicConversationTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicConversationSession" ADD CONSTRAINT "TopicConversationSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicConversationTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicConversationMessage" ADD CONSTRAINT "TopicConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TopicConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
