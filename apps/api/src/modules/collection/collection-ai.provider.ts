import { CollectionItemKindDto } from './dto';
import { CollectionRelationTypeDto } from './dto';

export enum CollectionChatIntent {
  TRANSLATE_ONLY = 'translate_only',
  ANALYZE_SENTENCE = 'analyze_sentence',
  FIND_EXISTING = 'find_existing',
  SUGGEST_CANDIDATES = 'suggest_candidates',
  CORRECT_SENTENCE = 'correct_sentence',
  EXPLAIN_USAGE = 'explain_usage',
}

export interface CollectionAiCard {
  id: string;
  front: string;
  meanings: CollectionAiCardMeaning[];
  reason: string;
  existingCardId?: string | null;
  added?: boolean;
}

export interface CollectionAiCardMeaning {
  zhMeaning: string;
  enExample?: string;
  zhExample?: string;
}

export interface CollectionAiCandidate {
  kind: CollectionItemKindDto;
  text: string;
  meaning: string;
  sourceWord?: string;
  sourceCardIds?: string[];
  alreadySaved?: boolean;
  relatedCandidates?: CollectionAiRelatedCandidate[];
}

export interface CollectionAiRelatedCandidate {
  type: CollectionRelationTypeDto;
  kind: Exclude<CollectionItemKindDto, CollectionItemKindDto.SENTENCE>;
  text: string;
  meaning: string;
  sourceCardIds?: string[];
}

export interface CollectionAiChatInput {
  userId: string;
  sessionId: string;
  providerThreadId?: string | null;
  message: string;
  intentHint?: string;
}

export interface CollectionAiChatResult {
  providerThreadId?: string | null;
  intent: CollectionChatIntent;
  message: string;
  candidates: CollectionAiCandidate[];
  suggestedCards: CollectionAiCard[];
}

export abstract class CollectionAiProvider {
  abstract runChat(
    input: CollectionAiChatInput,
  ): Promise<CollectionAiChatResult>;
}
