-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "primaryProvider" TEXT NOT NULL DEFAULT 'EMAIL',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "dailyNewCards" INTEGER NOT NULL DEFAULT 20,
    "dailyReviewCards" INTEGER NOT NULL DEFAULT 100,
    "dailyResetHour" INTEGER NOT NULL DEFAULT 4,
    "learningSteps" TEXT NOT NULL DEFAULT '1m,10m',
    "relearningSteps" TEXT NOT NULL DEFAULT '10m',
    "requestRetention" REAL NOT NULL DEFAULT 0.9,
    "maximumInterval" INTEGER NOT NULL DEFAULT 36500,
    "enableReverse" BOOLEAN NOT NULL DEFAULT false,
    "overrideDate" DATETIME,
    "overrideNewCards" INTEGER,
    "overrideReviewCards" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "front" TEXT NOT NULL,
    "note" TEXT,
    "deckId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "due" DATETIME,
    "stability" REAL,
    "difficulty" REAL,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" DATETIME,
    "learningStep" INTEGER NOT NULL DEFAULT 0,
    "reverseState" TEXT NOT NULL DEFAULT 'NEW',
    "reverseDue" DATETIME,
    "reverseStability" REAL,
    "reverseDifficulty" REAL,
    "reverseElapsedDays" INTEGER NOT NULL DEFAULT 0,
    "reverseScheduledDays" INTEGER NOT NULL DEFAULT 0,
    "reverseReps" INTEGER NOT NULL DEFAULT 0,
    "reverseLapses" INTEGER NOT NULL DEFAULT 0,
    "reverseLastReview" DATETIME,
    "reverseLearningStep" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Card_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TargetVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "zhMeaning" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNSEEN',
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expressionContext" TEXT,
    "naturalSentence" TEXT,
    "recommendationReason" TEXT,
    "lastExpressionAt" DATETIME,
    "lastRecommendationAt" DATETIME,
    "addedCardId" TEXT,
    "addedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TargetVocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TargetVocabulary_addedCardId_fkey" FOREIGN KEY ("addedCardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardMeaning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "zhMeaning" TEXT NOT NULL,
    "enExample" TEXT,
    "zhExample" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CardMeaning_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevState" TEXT NOT NULL,
    "prevStability" REAL,
    "prevDifficulty" REAL,
    "newState" TEXT NOT NULL,
    "newStability" REAL,
    "newDifficulty" REAL,
    "scheduledDays" INTEGER NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'FORWARD',
    CONSTRAINT "ReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "zhMeaning" TEXT,
    "note" TEXT,
    "createdFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionItemRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionItemRelation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CollectionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItemRelation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "CollectionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionItemCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionItemId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionItemCard_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItemCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OPENAI_AGENTS',
    "providerThreadId" TEXT,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollectionChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicConversationTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicConversationTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicConversationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicConversationSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicConversationTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicConversationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "correctionStatus" TEXT,
    "correctedText" TEXT,
    "correctionExplanation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TopicConversationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeakingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "legacyPracticeContext" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpeakingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeakingMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "translatedText" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'available',
    "hasOriginalAudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "SpeakingMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeakingReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeakingReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeakingReviewEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "targetVocabularyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "practicedAt" DATETIME NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "SpeakingReviewEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "SpeakingReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpeakingReviewEvent_targetVocabularyId_fkey" FOREIGN KEY ("targetVocabularyId") REFERENCES "TargetVocabulary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeakingLegacySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "SpeakingLegacySummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SpeakingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeakingWriteReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "initialContentHash" TEXT,
    "reviewContentHash" TEXT,
    "reviewId" TEXT,
    "actualUseCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeakingWriteReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CliLoginAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verifierHash" TEXT NOT NULL,
    "pairingCode" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CliLoginAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerId_key" ON "OAuthAccount"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "TargetVocabulary_userId_status_createdAt_idx" ON "TargetVocabulary"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TargetVocabulary_addedCardId_idx" ON "TargetVocabulary"("addedCardId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetVocabulary_userId_normalizedTerm_key" ON "TargetVocabulary"("userId", "normalizedTerm");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_kind_createdAt_idx" ON "CollectionItem"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_normalizedText_idx" ON "CollectionItem"("userId", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_userId_kind_normalizedText_key" ON "CollectionItem"("userId", "kind", "normalizedText");

-- CreateIndex
CREATE INDEX "CollectionItemRelation_childId_idx" ON "CollectionItemRelation"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItemRelation_parentId_childId_type_key" ON "CollectionItemRelation"("parentId", "childId", "type");

-- CreateIndex
CREATE INDEX "CollectionItemCard_cardId_idx" ON "CollectionItemCard"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItemCard_collectionItemId_cardId_role_key" ON "CollectionItemCard"("collectionItemId", "cardId", "role");

-- CreateIndex
CREATE INDEX "CollectionChatSession_userId_updatedAt_idx" ON "CollectionChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CollectionChatMessage_sessionId_createdAt_idx" ON "CollectionChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "TopicConversationTopic_userId_createdAt_idx" ON "TopicConversationTopic"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopicConversationTopic_userId_normalizedTitle_key" ON "TopicConversationTopic"("userId", "normalizedTitle");

-- CreateIndex
CREATE INDEX "TopicConversationSession_topicId_updatedAt_idx" ON "TopicConversationSession"("topicId", "updatedAt");

-- CreateIndex
CREATE INDEX "TopicConversationSession_updatedAt_idx" ON "TopicConversationSession"("updatedAt");

-- CreateIndex
CREATE INDEX "TopicConversationMessage_sessionId_createdAt_idx" ON "TopicConversationMessage"("sessionId", "createdAt");

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
