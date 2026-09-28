CREATE INDEX "Deck_userId_updatedAt_idx" ON "Deck"("userId", "updatedAt" DESC);
CREATE INDEX "Card_deckId_idx" ON "Card"("deckId");
CREATE INDEX "ReviewLog_cardId_reviewedAt_idx" ON "ReviewLog"("cardId", "reviewedAt");
