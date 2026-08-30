export * from "./aI.service";
import { AIService } from "./aI.service";
export * from "./auth.service";
import { AuthService } from "./auth.service";
export * from "./cards.service";
import { CardsService } from "./cards.service";
export * from "./cliAuth.service";
import { CliAuthService } from "./cliAuth.service";
export * from "./collections.service";
import { CollectionsService } from "./collections.service";
export * from "./deck.service";
import { DeckService } from "./deck.service";
export * from "./decks.service";
import { DecksService } from "./decks.service";
export * from "./speaking.service";
import { SpeakingService } from "./speaking.service";
export * from "./speakingHistory.service";
import { SpeakingHistoryService } from "./speakingHistory.service";
export * from "./study.service";
import { StudyService } from "./study.service";
export * from "./tTS.service";
import { TTSService } from "./tTS.service";
export * from "./targetVocabulary.service";
import { TargetVocabularyService } from "./targetVocabulary.service";
export * from "./topicConversations.service";
import { TopicConversationsService } from "./topicConversations.service";
export const APIS = [
  AIService,
  AuthService,
  CardsService,
  CliAuthService,
  CollectionsService,
  DeckService,
  DecksService,
  SpeakingService,
  SpeakingHistoryService,
  StudyService,
  TTSService,
  TargetVocabularyService,
  TopicConversationsService,
];
