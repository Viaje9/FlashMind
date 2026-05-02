-- CreateEnum
CREATE TYPE "CollectionItemKind" AS ENUM ('SENTENCE', 'COLLOCATION', 'PHRASE', 'CLAUSE');

-- CreateEnum
CREATE TYPE "CollectionRelationType" AS ENUM ('SENTENCE_HAS_COLLOCATION', 'SENTENCE_HAS_PHRASE', 'SENTENCE_HAS_CLAUSE', 'PHRASE_HAS_COLLOCATION', 'CLAUSE_HAS_COLLOCATION');

-- CreateEnum
CREATE TYPE "CollectionChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CollectionItemKind" NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "zhMeaning" TEXT,
    "note" TEXT,
    "createdFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItemRelation" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "CollectionRelationType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItemRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItemCard" (
    "id" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItemCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CODEX',
    "providerThreadId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "CollectionChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_userId_kind_normalizedText_key" ON "CollectionItem"("userId", "kind", "normalizedText");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_kind_createdAt_idx" ON "CollectionItem"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_normalizedText_idx" ON "CollectionItem"("userId", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItemRelation_parentId_childId_type_key" ON "CollectionItemRelation"("parentId", "childId", "type");

-- CreateIndex
CREATE INDEX "CollectionItemRelation_childId_idx" ON "CollectionItemRelation"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItemCard_collectionItemId_cardId_role_key" ON "CollectionItemCard"("collectionItemId", "cardId", "role");

-- CreateIndex
CREATE INDEX "CollectionItemCard_cardId_idx" ON "CollectionItemCard"("cardId");

-- CreateIndex
CREATE INDEX "CollectionChatSession_userId_updatedAt_idx" ON "CollectionChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CollectionChatMessage_sessionId_createdAt_idx" ON "CollectionChatMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItemRelation" ADD CONSTRAINT "CollectionItemRelation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItemRelation" ADD CONSTRAINT "CollectionItemRelation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItemCard" ADD CONSTRAINT "CollectionItemCard_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItemCard" ADD CONSTRAINT "CollectionItemCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionChatSession" ADD CONSTRAINT "CollectionChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionChatMessage" ADD CONSTRAINT "CollectionChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollectionChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
