-- Create required postgres extensions
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "ReviewRating" AS ENUM ('again', 'hard', 'easy');
CREATE TYPE "ReviewOrder" AS ENUM ('due_first', 'new_first', 'mixed');
CREATE TYPE "Authority" AS ENUM ('local', 'server');
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'synced', 'conflicted');
CREATE TYPE "SyncEventType" AS ENUM ('merge', 'overwrite', 'conflict_resolution');

-- Tables
CREATE TABLE "User" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" CITEXT UNIQUE,
    "displayName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "DeviceSession" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deviceFingerprint" TEXT NOT NULL UNIQUE,
    "userId" UUID,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Deck" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ownerUserId" UUID,
    "ownerDeviceId" UUID,
    "name" CITEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dailyNewLimit" INTEGER NOT NULL DEFAULT 10,
    "reviewOrder" "ReviewOrder" NOT NULL DEFAULT 'due_first',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "version" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "DeckStatSnapshot" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deckId" UUID NOT NULL,
    "dueToday" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "avgRetention" NUMERIC NOT NULL,
    "generatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "Card" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deckId" UUID NOT NULL,
    "term" CITEXT NOT NULL,
    "notes" TEXT,
    "senses" JSONB NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "version" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "CardState" (
    "cardId" UUID PRIMARY KEY,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "elapsedDays" INTEGER NOT NULL,
    "scheduledDays" INTEGER NOT NULL,
    "due" DATE NOT NULL,
    "lastReviewedAt" TIMESTAMPTZ,
    "reviewCount" INTEGER NOT NULL,
    "lastRating" "ReviewRating",
    "authority" "Authority" NOT NULL DEFAULT 'local',
    "version" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "ReviewLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "cardId" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "userId" UUID,
    "deviceId" UUID NOT NULL,
    "rating" "ReviewRating" NOT NULL,
    "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "sessionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'pending',
    "payloadVersion" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "SyncEvent" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deviceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SyncEventType" NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign keys
ALTER TABLE "DeviceSession"
ADD CONSTRAINT "DeviceSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Deck"
ADD CONSTRAINT "Deck_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Deck"
ADD CONSTRAINT "Deck_ownerDeviceId_fkey"
FOREIGN KEY ("ownerDeviceId") REFERENCES "DeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeckStatSnapshot"
ADD CONSTRAINT "DeckStatSnapshot_deckId_fkey"
FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Card"
ADD CONSTRAINT "Card_deckId_fkey"
FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Card"
ADD CONSTRAINT "Card_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CardState"
ADD CONSTRAINT "CardState_cardId_fkey"
FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewLog"
ADD CONSTRAINT "ReviewLog_cardId_fkey"
FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewLog"
ADD CONSTRAINT "ReviewLog_deckId_fkey"
FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewLog"
ADD CONSTRAINT "ReviewLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewLog"
ADD CONSTRAINT "ReviewLog_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncEvent"
ADD CONSTRAINT "SyncEvent_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncEvent"
ADD CONSTRAINT "SyncEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes & constraints
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession" ("userId");

CREATE INDEX "Deck_ownerUserId_idx" ON "Deck" ("ownerUserId");
CREATE INDEX "Deck_ownerDeviceId_idx" ON "Deck" ("ownerDeviceId");
CREATE UNIQUE INDEX "Deck_ownerUserId_name_key" ON "Deck" ("ownerUserId", "name");
CREATE UNIQUE INDEX "Deck_ownerDeviceId_name_key" ON "Deck" ("ownerDeviceId", "name");
CREATE UNIQUE INDEX "Deck_ownerUserId_slug_key" ON "Deck" ("ownerUserId", "slug");
CREATE UNIQUE INDEX "Deck_ownerDeviceId_slug_key" ON "Deck" ("ownerDeviceId", "slug");

CREATE INDEX "DeckStatSnapshot_deckId_idx" ON "DeckStatSnapshot" ("deckId");
CREATE INDEX "DeckStatSnapshot_generatedAt_idx" ON "DeckStatSnapshot" ("generatedAt");

CREATE INDEX "Card_deckId_idx" ON "Card" ("deckId");
CREATE UNIQUE INDEX "Card_deckId_term_key" ON "Card" ("deckId", "term");

CREATE INDEX "ReviewLog_cardId_idx" ON "ReviewLog" ("cardId");
CREATE INDEX "ReviewLog_deckId_idx" ON "ReviewLog" ("deckId");
CREATE INDEX "ReviewLog_userId_idx" ON "ReviewLog" ("userId");
CREATE INDEX "ReviewLog_deviceId_idx" ON "ReviewLog" ("deviceId");
CREATE UNIQUE INDEX "ReviewLog_device_session_sequence_key" ON "ReviewLog" ("deviceId", "sessionId", "sequence");

CREATE INDEX "SyncEvent_deviceId_idx" ON "SyncEvent" ("deviceId");
CREATE INDEX "SyncEvent_userId_idx" ON "SyncEvent" ("userId");
CREATE INDEX "SyncEvent_createdAt_idx" ON "SyncEvent" ("createdAt");
