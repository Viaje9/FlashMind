// 此檔由 openapi/speaking-history.yaml 產生，請勿手動修改。
export type SpeakingHistorySource = "APP" | "LOCAL";

export type SpeakingPracticePlan = {
  topic: string;
  speakingGoal: string;
  guidingQuestions: Array<string>;
  recallTargets: Array<string>;
};

export type SpeakingHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  translatedText?: string;
  hasOriginalAudio?: boolean;
  transcriptStatus?: "available" | "unavailable";
};

export type SpeakingSourceRef = {
  system: string;
  conversationId: string;
  sessionKey: string;
};

export type SpeakingReviewEvidence = {
  messageId: string;
  quote: string;
};

export type SpeakingRecordedUse = {
  targetVocabularyId: string;
  term: string;
  expressionContext: string;
  naturalSentence: string;
  evidence: Array<SpeakingReviewEvidence>;
};

export type SpeakingRecordedRecommendation = {
  targetVocabularyId: string;
  term: string;
  expressionContext: string;
  naturalSentence: string;
  recommendationReason: string;
};

export type SpeakingRecordedResult = {
  summary: string;
  review: string;
  actualUses: Array<SpeakingRecordedUse>;
  recommendations: Array<SpeakingRecordedRecommendation>;
  nextPractice: SpeakingPracticePlan;
  deckCandidates: Array<string>;
};

export type SpeakingReviewDraft = {
  schemaVersion: 1;
  target: {
    apiOrigin: string;
    userId: string;
  };
  contextVersion: string;
  practice: {
    source: SpeakingHistorySource;
    sourceRef: SpeakingSourceRef;
    sessionId?: string;
    title: string;
    startedAt: string;
    endedAt: string;
    range: {
      firstMessageId: string;
      lastMessageId: string;
    };
    messages: Array<SpeakingHistoryMessage>;
  };
  result: SpeakingRecordedResult;
};

export type SpeakingValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type SpeakingReviewValidation = {
  valid: boolean;
  contentHash: string | null;
  errors: Array<SpeakingValidationIssue>;
  warnings: Array<SpeakingValidationIssue>;
};

export type SpeakingSavedReview = {
  sessionId: string;
  reviewId: string;
  status: "saved" | "alreadySaved";
  actualUseCount: number;
  recommendationCount: number;
};

export type SpeakingContextWord = {
  id: string;
  term: string;
  zhMeaning: string;
  status: "UNSEEN" | "PRACTICING" | "USED" | "ADDED";
  useCount: number;
  recommendationCount: number;
  expressionContext: string | null;
  naturalSentence: string | null;
  recommendationReason: string | null;
  addedCardId: string | null;
};

export type SpeakingPracticeContext = {
  schemaVersion: 1;
  userId: string;
  generatedAt: string;
  vocabularyVersion: string;
  vocabularyCount: number;
  targetVocabulary: Array<SpeakingContextWord>;
  lastPractice: {
    sessionId: string;
    source: SpeakingHistorySource;
    title: string;
    summary: string;
    startedAt: string;
    endedAt: string;
  } | null;
  nextPractice: SpeakingPracticePlan | null;
};

export type SpeakingSessionCreate = {
  clientSessionId: string;
  title: string;
  startedAt: string;
  expectedUserId: string;
};

export type SpeakingMessagesAppend = {
  revision: number;
  messages: Array<SpeakingHistoryMessage>;
  endedAt?: string;
  expectedUserId: string;
};

export type SpeakingLegacySummaryInput = {
  id: string;
  text: string;
  createdAt: string;
  ordinal: number;
};

export type SpeakingLegacySession = {
  clientSessionId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  messages: Array<SpeakingHistoryMessage>;
  summaries: Array<SpeakingLegacySummaryInput>;
  legacyPracticeContext?: {
    summaryId: string;
    plan: SpeakingPracticePlan;
  };
};

export type SpeakingHistoryMigration = {
  sessions: Array<SpeakingLegacySession>;
  expectedUserId: string;
};

export type SpeakingMigrationResult = {
  clientSessionId: string;
  sessionId: string | null;
  status: "imported" | "alreadyImported" | "conflict" | "failed";
  message: string | null;
};

export type SpeakingSessionRecord = {
  id: string;
  clientSessionId: string;
  source: SpeakingHistorySource;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
  messageCount: number;
  reviewed: boolean;
  summary: string | null;
};

export type SpeakingSessionDetail = {
  session: SpeakingSessionRecord;
  review: SpeakingRecordedResult | null;
  legacySummaries: Array<SpeakingLegacySummaryInput>;
};

export type SpeakingHistoryPageMeta = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type CliAuthorizationCreate = {
  verifierHash: string;
};

export type CliAuthorizationStarted = {
  authorizationId: string;
  verificationUrl: string;
  pairingCode: string;
  expiresAt: string;
  pollIntervalMs: number;
};

export type CliAuthorizationApprove = {
  pairingCode: string;
  decision: "approve" | "deny";
  expectedUserId: string;
};

export type CliAuthorizationExchange = {
  verifier: string;
};

export type CliAuthorizationStatus = {
  status: "pending" | "approved" | "denied";
  expiresAt: string;
  userId: string | null;
  email: string | null;
};

export type SpeakingHistoryError = {
  error: {
    code: string;
    message: string;
    details?: Array<SpeakingValidationIssue>;
  };
};
