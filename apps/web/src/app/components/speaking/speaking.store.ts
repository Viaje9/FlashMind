import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import {
  SpeakingService as SpeakingApiService,
  type SpeakingAssistantMessage,
} from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import { blobToWavBlob } from './speaking-audio.utils';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';
import {
  SpeakingRealtimeService,
  type SpeakingRealtimeTurnResult,
} from './speaking-realtime.service';
import { SpeakingFullDuplexAudioService } from './speaking-full-duplex-audio.service';
import {
  SPEAKING_HISTORY_LIMIT_BYTES,
  createSelectionTranslationCacheKey,
  createConversationRecord,
  createSpeakingId,
  formatSpeakingReviewSummary,
  normalizeSelectionTranslationText,
  toSpeakingHistory,
  updateConversationFromMessages,
  type SpeakingAssistantMessage as LocalAssistantMessage,
  type SpeakingConversation,
  type SpeakingMessage,
  type SpeakingSelectionTranslationRequest,
  type SpeakingSelectionTranslationResult,
  type SpeakingSettings,
  type SpeakingStoreState,
} from './speaking.domain';
import { SpeakingRepository } from './speaking.repository';
import { SKIP_LOADING } from '../../interceptors/loading.interceptor';

interface RetryPayload {
  conversationId: string;
  userMessageId: string;
  userAudioKey: string;
  historyBefore: SpeakingMessage[];
  audioBlob: Blob;
}

@Injectable({ providedIn: 'root' })
export class SpeakingStore {
  private readonly speakingApi = inject(SpeakingApiService);
  private readonly repository = inject(SpeakingRepository);
  private readonly audioPlayer = inject(SpeakingAudioPlayerService);
  private readonly realtime = inject(SpeakingRealtimeService);
  private readonly fullDuplexAudio = inject(SpeakingFullDuplexAudioService);
  private readonly skipLoadingContext = new HttpContext().set(SKIP_LOADING, true);

  private readonly state = signal<SpeakingStoreState>({
    conversationId: null,
    messages: [],
    sending: false,
    summarizing: false,
    loadingConversation: false,
    translatingMessageId: null,
    assistantMessages: [],
    assistantSending: false,
    retryAvailable: false,
    error: null,
  });

  private readonly speakingSettingsState = signal(this.repository.loadSettings());
  private readonly selectionTranslationCache = new Map<string, string>();
  private retryPayload: RetryPayload | null = null;
  private livePersistenceQueue = Promise.resolve();
  private readonly fullDuplexActiveState = signal(false);

  readonly conversationId = computed(() => this.state().conversationId);
  readonly messages = computed(() => this.state().messages);
  readonly sending = computed(() => this.state().sending);
  readonly summarizing = computed(() => this.state().summarizing);
  readonly loadingConversation = computed(() => this.state().loadingConversation);
  readonly translatingMessageId = computed(() => this.state().translatingMessageId);
  readonly assistantMessages = computed(() => this.state().assistantMessages);
  readonly assistantSending = computed(() => this.state().assistantSending);
  readonly retryAvailable = computed(() => this.state().retryAvailable);
  readonly error = computed(() => this.state().error ?? this.audioPlayer.error());
  readonly speakingSettings = computed(() => this.speakingSettingsState());
  readonly playingAudioKey = computed(() => this.audioPlayer.playingKey());
  readonly pausedAudioKey = computed(() => this.audioPlayer.pausedKey());
  readonly fullDuplexActive = computed(() => this.fullDuplexActiveState());

  async activateSharedAudioTrack(): Promise<void> {
    await this.audioPlayer.activateSharedTrack();
  }

  deactivateSharedAudioTrack(): void {
    this.audioPlayer.deactivateSharedTrack();
  }

  setAudioPlaybackMuted(muted: boolean): void {
    this.audioPlayer.setMuted(muted);
  }

  async startNewConversation(): Promise<void> {
    const assistantMessages = this.state().assistantMessages;
    this.stopFullDuplexConversation();
    this.audioPlayer.stop();
    this.realtime.disconnect();
    this.retryPayload = null;
    this.state.set({
      conversationId: createSpeakingId(),
      messages: [],
      sending: false,
      summarizing: false,
      loadingConversation: false,
      translatingMessageId: null,
      assistantMessages,
      assistantSending: false,
      retryAvailable: false,
      error: null,
    });
  }

  async loadConversation(conversationId: string): Promise<boolean> {
    this.stopFullDuplexConversation();
    this.realtime.disconnect();
    this.state.update((state) => ({ ...state, loadingConversation: true, error: null }));

    try {
      const result = await this.repository.getConversation(conversationId);
      if (!result) {
        this.state.update((state) => ({ ...state, loadingConversation: false }));
        return false;
      }

      this.retryPayload = null;
      this.state.update((state) => ({
        ...state,
        conversationId,
        messages: result.messages,
        loadingConversation: false,
        retryAvailable: false,
      }));

      return true;
    } catch {
      this.state.update((state) => ({
        ...state,
        loadingConversation: false,
        error: '讀取口說歷史失敗，請稍後再試',
      }));
      return false;
    }
  }

  async prepareRealtimeSession(): Promise<void> {
    const current = this.state();
    const conversationId = current.conversationId ?? createSpeakingId();
    if (!current.conversationId) {
      this.state.update((state) => ({ ...state, conversationId }));
    }

    const settings = this.repository.loadSettings();
    this.speakingSettingsState.set(settings);
    try {
      await this.realtime.connect({
        conversationId,
        settings,
        history: current.messages,
      });
    } catch (error) {
      console.error('[Speaking] Realtime request failed', error);
      this.state.update((state) => ({
        ...state,
        error: this.resolveSpeakingErrorMessage(error),
      }));
      throw error;
    }
  }

  disconnectRealtimeSession(): void {
    this.stopFullDuplexConversation();
    this.realtime.disconnect();
  }

  async startFullDuplexConversation(): Promise<void> {
    await this.prepareRealtimeSession();
    this.audioPlayer.stop();
    this.realtime.startLive({
      onSpeechStarted: () => {
        const interrupted = this.fullDuplexAudio.interruptPlayback();
        if (interrupted) {
          this.realtime.truncateAssistantAudio(interrupted.itemId, interrupted.audioEndMs);
        }
      },
      onAssistantItem: (itemId) => this.fullDuplexAudio.beginAssistantItem(itemId),
      onAudioDelta: (audio) => this.fullDuplexAudio.playPcm16Chunk(audio),
      onTurnCompleted: (result) => {
        this.livePersistenceQueue = this.livePersistenceQueue
          .then(() => this.persistFullDuplexTurn(result))
          .catch((error) => {
            this.state.update((state) => ({
              ...state,
              error: this.resolveSpeakingErrorMessage(error),
            }));
          });
      },
      onError: (message) => {
        this.fullDuplexActiveState.set(false);
        this.fullDuplexAudio.stop();
        this.state.update((state) => ({ ...state, error: message }));
      },
    });

    try {
      await this.fullDuplexAudio.start((audio) => this.realtime.appendLiveAudio(audio));
      this.fullDuplexActiveState.set(true);
    } catch (error) {
      this.realtime.stopLive();
      this.state.update((state) => ({
        ...state,
        error: this.resolveSpeakingErrorMessage(error),
      }));
      throw error;
    }
  }

  stopFullDuplexConversation(): void {
    this.fullDuplexActiveState.set(false);
    this.fullDuplexAudio.stop();
    this.realtime.stopLive();
  }

  async sendAudioMessage(audioBlob: Blob): Promise<void> {
    if (this.state().sending || !audioBlob || audioBlob.size === 0) {
      return;
    }

    const currentState = this.state();
    const conversationId = currentState.conversationId ?? createSpeakingId();
    const historyBefore = [...currentState.messages];

    const normalizedAudioBlob = await this.safeConvertToWav(audioBlob);
    const userMessageId = createSpeakingId();
    const userAudioKey = await this.repository.saveAudioBlob({
      conversationId,
      messageId: userMessageId,
      blob: normalizedAudioBlob,
      mimeType: normalizedAudioBlob.type,
      audioKey: `${userMessageId}:audio`,
    });

    const userMessage: SpeakingMessage = {
      id: userMessageId,
      conversationId,
      role: 'user',
      text: '',
      audioBlobKey: userAudioKey,
      audioMimeType: normalizedAudioBlob.type || 'audio/wav',
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...historyBefore, userMessage];

    this.state.update((state) => ({
      ...state,
      conversationId,
      messages: nextMessages,
      sending: true,
      error: null,
      retryAvailable: false,
    }));

    await this.repository.saveMessage(userMessage);
    await this.persistConversation(conversationId, nextMessages);

    this.retryPayload = {
      conversationId,
      userMessageId,
      userAudioKey,
      historyBefore,
      audioBlob: normalizedAudioBlob,
    };

    const handled = await this.requestAssistantReply(this.retryPayload);

    if (!handled) {
      this.state.update((state) => ({
        ...state,
        sending: false,
        retryAvailable: true,
      }));
    }
  }

  async retryLastAudio(): Promise<void> {
    if (!this.retryPayload || this.state().sending) {
      return;
    }

    this.state.update((state) => ({ ...state, sending: true, error: null }));
    const handled = await this.requestAssistantReply(this.retryPayload);

    if (!handled) {
      this.state.update((state) => ({
        ...state,
        sending: false,
        retryAvailable: true,
      }));
    }
  }

  async summarizeCurrentConversation(): Promise<void> {
    const currentState = this.state();
    if (currentState.messages.length === 0 || currentState.summarizing) {
      return;
    }

    this.state.update((state) => ({ ...state, summarizing: true, error: null }));

    try {
      const history = await toSpeakingHistory(
        currentState.messages,
        this.repository.getAudioBase64.bind(this.repository),
      );

      const response = await firstValueFrom(
        this.speakingApi.summarizeSpeakingConversation({ history }),
      );
      const summaryText = formatSpeakingReviewSummary(response.data).trim();

      if (!summaryText) {
        throw new Error('summary empty');
      }

      const conversationId = currentState.conversationId ?? createSpeakingId();
      const summaryMessage: SpeakingMessage = {
        id: createSpeakingId(),
        conversationId,
        role: 'summary',
        text: summaryText,
        createdAt: new Date().toISOString(),
        usage: response.data.usage,
      };

      const nextMessages = [...this.state().messages, summaryMessage];

      this.state.update((state) => ({
        ...state,
        conversationId,
        messages: nextMessages,
        summarizing: false,
      }));

      await this.repository.saveMessage(summaryMessage);
      const updatedSettings: SpeakingSettings = {
        ...this.repository.loadSettings(),
        lastPractice: {
          title: response.data.title,
          summary: response.data.summary,
        },
        nextPractice: response.data.nextPractice,
      };
      this.repository.saveSettings(updatedSettings);
      this.speakingSettingsState.set(updatedSettings);
      await this.persistConversation(conversationId, nextMessages, {
        title: response.data.title,
        summary: response.data.summary,
      });
    } catch {
      this.state.update((state) => ({
        ...state,
        summarizing: false,
        error: '產生摘要失敗，請稍後再試',
      }));
    }
  }

  async translateMessage(messageId: string): Promise<void> {
    const target = this.state().messages.find((item) => item.id === messageId);
    if (
      !target ||
      target.role !== 'assistant' ||
      !target.text ||
      this.state().translatingMessageId
    ) {
      return;
    }

    if (target.translatedText?.trim()) {
      return;
    }

    this.state.update((state) => ({ ...state, translatingMessageId: messageId, error: null }));

    try {
      const response = await firstValueFrom(
        this.speakingApi.translateSpeakingText(
          {
            text: target.text,
          },
          undefined,
          undefined,
          { context: this.skipLoadingContext },
        ),
      );

      const translatedText = response.data.translatedText.trim();

      const nextMessages = this.state().messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              translatedText,
            }
          : message,
      );

      this.state.update((state) => ({
        ...state,
        messages: nextMessages,
        translatingMessageId: null,
      }));

      const updated = nextMessages.find((item) => item.id === messageId);
      if (updated) {
        await this.repository.saveMessage(updated);
      }

      const conversationId = this.state().conversationId;
      if (conversationId) {
        await this.persistConversation(conversationId, nextMessages);
      }
    } catch {
      this.state.update((state) => ({
        ...state,
        translatingMessageId: null,
        error: '翻譯失敗，請稍後再試',
      }));
    }
  }

  async translateSelectedText(
    input: SpeakingSelectionTranslationRequest,
  ): Promise<SpeakingSelectionTranslationResult> {
    const selectedText = normalizeSelectionTranslationText(input.selectedText);

    if (!selectedText) {
      return {
        status: 'error',
        requestToken: input.requestToken,
        errorMessage: '請先選取要翻譯的文字',
      };
    }

    if (selectedText.length > 4000) {
      return {
        status: 'error',
        requestToken: input.requestToken,
        errorMessage: '選取文字過長，請縮短範圍後再試',
      };
    }

    const cacheKey = createSelectionTranslationCacheKey(input.messageId, selectedText);
    const cached = this.selectionTranslationCache.get(cacheKey);
    if (cached) {
      return {
        status: 'success',
        requestToken: input.requestToken,
        translatedText: cached,
        cached: true,
      };
    }

    try {
      const response = await firstValueFrom(
        this.speakingApi.translateSpeakingText({ text: selectedText }, undefined, undefined, {
          context: this.skipLoadingContext,
        }),
      );

      const translatedText = response.data.translatedText.trim();
      if (!translatedText) {
        throw new Error('empty translation');
      }

      this.selectionTranslationCache.set(cacheKey, translatedText);
      return {
        status: 'success',
        requestToken: input.requestToken,
        translatedText,
        cached: false,
      };
    } catch {
      return {
        status: 'error',
        requestToken: input.requestToken,
        errorMessage: '翻譯失敗，請稍後再試',
      };
    }
  }

  async sendAssistantMessage(content: string): Promise<void> {
    const message = content.trim();
    if (!message || this.state().assistantSending) {
      return;
    }

    const userMessage: LocalAssistantMessage = {
      id: createSpeakingId(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...this.state().assistantMessages, userMessage];
    this.state.update((state) => ({
      ...state,
      assistantMessages: nextMessages,
      assistantSending: true,
      error: null,
    }));

    try {
      const history = nextMessages.slice(0, -1).map<SpeakingAssistantMessage>((item) => ({
        role: item.role,
        content: item.content,
      }));

      const response = await firstValueFrom(
        this.speakingApi.chatSpeakingAssistant({
          message,
          history,
        }),
      );

      const assistantReply = response.data.reply.trim();
      if (!assistantReply) {
        throw new Error('assistant reply empty');
      }

      const assistantMessage: LocalAssistantMessage = {
        id: createSpeakingId(),
        role: 'assistant',
        content: assistantReply,
        createdAt: new Date().toISOString(),
      };

      this.state.update((state) => ({
        ...state,
        assistantSending: false,
        assistantMessages: [...state.assistantMessages, assistantMessage],
      }));
    } catch {
      const fallbackMessage: LocalAssistantMessage = {
        id: createSpeakingId(),
        role: 'assistant',
        content: '抱歉，回覆失敗，請再試一次。',
        createdAt: new Date().toISOString(),
      };

      this.state.update((state) => ({
        ...state,
        assistantSending: false,
        assistantMessages: [...state.assistantMessages, fallbackMessage],
        error: 'AI 助手目前無法回覆，請稍後再試',
      }));
    }
  }

  clearAssistantMessages(): void {
    this.state.update((state) => ({ ...state, assistantMessages: [] }));
  }

  hydrateAssistantMessages(messages: LocalAssistantMessage[]): void {
    const sanitized = messages
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
      .map((item) => ({
        id: item.id || createSpeakingId(),
        role: item.role,
        content: item.content?.trim() ?? '',
        createdAt: item.createdAt || new Date().toISOString(),
      }))
      .filter((item) => item.content.trim().length > 0);

    this.state.update((state) => ({
      ...state,
      assistantMessages: sanitized,
    }));
  }

  async playMessageAudio(messageId: string): Promise<void> {
    const message = this.state().messages.find((item) => item.id === messageId);
    if (!message?.audioBlobKey) {
      return;
    }

    if (this.audioPlayer.playingKey() === message.audioBlobKey) {
      this.audioPlayer.pause();
      return;
    }

    if (this.audioPlayer.pausedKey() === message.audioBlobKey) {
      await this.audioPlayer.resume();
      return;
    }

    const blob = await this.repository.getAudioBlob(message.audioBlobKey);
    if (!blob) {
      this.state.update((state) => ({ ...state, error: '語音檔不存在，請重新錄音。' }));
      return;
    }

    await this.audioPlayer.play(blob, message.audioBlobKey, { auto: false });
  }

  stopAudioPlayback(): void {
    this.audioPlayer.stop();
  }

  refreshSpeakingSettings(): void {
    this.speakingSettingsState.set(this.repository.loadSettings());
  }

  clearError(): void {
    this.state.update((state) => ({ ...state, error: null }));
    this.audioPlayer.clearError();
  }

  private async requestAssistantReply(payload: RetryPayload): Promise<boolean> {
    const settings = this.repository.loadSettings();
    this.speakingSettingsState.set(settings);

    try {
      await this.realtime.connect({
        conversationId: payload.conversationId,
        settings,
        history: payload.historyBefore,
      });
      const response = await this.realtime.sendTurn(payload.audioBlob);

      const transcript = response.assistantTranscript.trim();
      if (!transcript) {
        throw new Error('assistant transcript empty');
      }

      const assistantMessageId = createSpeakingId();
      const assistantAudioBlob = response.assistantAudio;
      const assistantAudioKey = await this.repository.saveAudioBlob({
        conversationId: payload.conversationId,
        messageId: assistantMessageId,
        blob: assistantAudioBlob,
        mimeType: assistantAudioBlob.type,
        audioKey: `${assistantMessageId}:audio`,
      });

      let translatedText: string | undefined;
      if (settings.autoTranslate) {
        translatedText = await this.translateText(transcript);
      }

      const assistantMessage: SpeakingMessage = {
        id: assistantMessageId,
        conversationId: payload.conversationId,
        role: 'assistant',
        text: transcript,
        translatedText,
        audioBlobKey: assistantAudioKey,
        audioMimeType: assistantAudioBlob.type || 'audio/wav',
        createdAt: new Date().toISOString(),
        usage: response.usage,
        transcriptionDurationSeconds: response.transcriptionDurationSeconds,
      };

      if (response.memoryUpdate?.memory) {
        const updatedSettings = { ...settings, memory: response.memoryUpdate.memory };
        this.repository.saveSettings(updatedSettings);
        this.speakingSettingsState.set(updatedSettings);
      }

      const stateMessages = this.state().messages;
      const userExists = stateMessages.some((item) => item.id === payload.userMessageId);
      const ensuredMessages = userExists
        ? stateMessages.map((item) =>
            item.id === payload.userMessageId
              ? { ...item, text: response.userTranscript.trim() }
              : item,
          )
        : [
            ...stateMessages,
            {
              id: payload.userMessageId,
              conversationId: payload.conversationId,
              role: 'user' as const,
              text: response.userTranscript.trim(),
              audioBlobKey: payload.userAudioKey,
              audioMimeType: payload.audioBlob.type || 'audio/webm',
              createdAt: new Date().toISOString(),
            },
          ];

      const nextMessages = [...ensuredMessages, assistantMessage];

      this.state.update((state) => ({
        ...state,
        conversationId: payload.conversationId,
        messages: nextMessages,
        sending: false,
        retryAvailable: false,
        error: null,
      }));

      await this.repository.saveMessage(assistantMessage);
      const updatedUserMessage = nextMessages.find((item) => item.id === payload.userMessageId);
      if (updatedUserMessage) {
        await this.repository.saveMessage(updatedUserMessage);
      }
      await this.persistConversation(payload.conversationId, nextMessages);
      await this.repository.enforceConversationStorageLimit(
        SPEAKING_HISTORY_LIMIT_BYTES,
        payload.conversationId,
      );

      this.retryPayload = null;

      if (settings.autoPlayVoice) {
        const playback = this.audioPlayer.play(assistantAudioBlob, assistantAudioKey, {
          auto: true,
          waitForEnd: settings.interactionMode === 'REALTIME',
        });
        if (settings.interactionMode === 'REALTIME') await playback;
      }

      return true;
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        sending: false,
        error: this.resolveSpeakingErrorMessage(error),
      }));
      return false;
    }
  }

  private async persistFullDuplexTurn(result: SpeakingRealtimeTurnResult): Promise<void> {
    const userTranscript = result.userTranscript.trim();
    const assistantTranscript = result.assistantTranscript.trim();
    if (!userTranscript || !assistantTranscript) return;

    const conversationId = this.state().conversationId ?? createSpeakingId();
    const settings = this.repository.loadSettings();
    const userMessage: SpeakingMessage = {
      id: createSpeakingId(),
      conversationId,
      role: 'user',
      text: userTranscript,
      createdAt: new Date().toISOString(),
    };

    const assistantMessageId = createSpeakingId();
    const assistantAudioKey = await this.repository.saveAudioBlob({
      conversationId,
      messageId: assistantMessageId,
      blob: result.assistantAudio,
      mimeType: result.assistantAudio.type,
      audioKey: `${assistantMessageId}:audio`,
    });
    const translatedText = settings.autoTranslate
      ? await this.translateText(assistantTranscript)
      : undefined;
    const assistantMessage: SpeakingMessage = {
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      text: assistantTranscript,
      translatedText,
      audioBlobKey: assistantAudioKey,
      audioMimeType: result.assistantAudio.type || 'audio/wav',
      createdAt: new Date().toISOString(),
      usage: result.usage,
      transcriptionDurationSeconds: result.transcriptionDurationSeconds,
    };

    if (result.memoryUpdate?.memory) {
      const updatedSettings = { ...settings, memory: result.memoryUpdate.memory };
      this.repository.saveSettings(updatedSettings);
      this.speakingSettingsState.set(updatedSettings);
    }

    const nextMessages = [...this.state().messages, userMessage, assistantMessage];
    this.state.update((state) => ({
      ...state,
      conversationId,
      messages: nextMessages,
      error: null,
    }));
    await this.repository.saveMessage(userMessage);
    await this.repository.saveMessage(assistantMessage);
    await this.persistConversation(conversationId, nextMessages);
    await this.repository.enforceConversationStorageLimit(
      SPEAKING_HISTORY_LIMIT_BYTES,
      conversationId,
    );
  }

  private async persistConversation(
    conversationId: string,
    messages: SpeakingMessage[],
    overrides?: { title?: string; summary?: string },
  ): Promise<void> {
    const existing = await this.repository.getConversation(conversationId);

    const baseConversation: SpeakingConversation =
      existing?.conversation ??
      createConversationRecord({
        id: conversationId,
        firstMessageText: messages.find((item) => item.text?.trim())?.text,
      });

    const conversation = updateConversationFromMessages(baseConversation, messages);

    if (overrides?.title?.trim()) {
      conversation.title = overrides.title.trim();
    }

    if (overrides?.summary !== undefined) {
      conversation.summary = overrides.summary;
    }

    await this.repository.saveConversation(conversation);
  }

  private async safeConvertToWav(blob: Blob): Promise<Blob> {
    try {
      return await blobToWavBlob(blob);
    } catch {
      return blob;
    }
  }

  private async translateText(text: string): Promise<string | undefined> {
    const normalized = text.trim();
    if (!normalized) {
      return undefined;
    }

    try {
      const response = await firstValueFrom(
        this.speakingApi.translateSpeakingText({ text: normalized }, undefined, undefined, {
          context: this.skipLoadingContext,
        }),
      );
      return response.data.translatedText.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private resolveSpeakingErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      if (error.message.includes('WAV PCM16') || error.message.includes('WAV 找不到')) {
        return '錄音轉換失敗，請重新錄音後再送出。';
      }
      if (error.message.includes('WebSocket') || error.message.includes('Realtime')) {
        return error.message;
      }
    }

    const httpError = error as HttpErrorResponse | undefined;
    const status = httpError?.status;

    if (status === 413) {
      return '語音檔案過大，請縮短錄音後再試。';
    }

    if (status === 401) {
      return '登入已失效，請重新登入後再試。';
    }

    if (status === 403) {
      return '目前帳號尚未開通口說權限。';
    }

    if (status === 400) {
      return '語音資料格式不正確，請重新錄音後再送出。';
    }

    if (status === 0) {
      return '網路連線異常，請確認網路後重試。';
    }

    return '語音口說請求失敗，請點擊重試。';
  }
}
