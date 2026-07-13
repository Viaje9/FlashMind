ALTER TABLE "TopicConversationSession" ADD COLUMN "startedAt" TIMESTAMP(3);

UPDATE "TopicConversationSession" AS session
SET "startedAt" = session."createdAt"
WHERE EXISTS (
  SELECT 1
  FROM "TopicConversationMessage" AS message
  WHERE message."sessionId" = session."id"
    AND message."role" = 'USER'
);

CREATE INDEX "TopicConversationSession_startedAt_updatedAt_idx"
ON "TopicConversationSession"("startedAt", "updatedAt");
