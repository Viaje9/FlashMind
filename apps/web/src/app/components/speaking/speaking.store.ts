import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import {
  SpeakingService as SpeakingApiService,
  type SpeakingAssistantMessage,
} from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import { base64ToBlob, blobToWavBlob } from './speaking-audio.utils';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';
import {
  SPEAKING_HISTORY_LIMIT_BYTES,
  createConversationRecord,
  createSpeakingId,
  toSpeakingHistory,
  updateConversationFromMessages,
  type SpeakingAssistantMessage as LocalAssistantMessage,
  type SpeakingConversation,
  type SpeakingMessage,
  type SpeakingSettings,
  type SpeakingStoreState,
} from './speaking.domain';
import { SpeakingRepository } from './speaking.repository';
import { SKIP_LOADING } from '../../interceptors/loading.interceptor';

interface RetryPayload {
  localConversationId: string;
  requestConversationId?: string;
  userMessage: SpeakingMessage;
  audioBlob: Blob;
}

@Injectable({ providedIn: 'root' })
export class SpeakingStore {
  private readonly speakingApi = inject(SpeakingApiService);
  private readonly repository = inject(SpeakingRepository);
  private readonly audioPlayer = inject(SpeakingAudioPlayerService);
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
  private retryPayload: RetryPayload | null = null;
  private activeServerConversationId: string | null = null;

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

  async startNewConversation(): Promise<void> {
    const assistantMessages = this.state().assistantMessages;
    this.audioPlayer.stop();
    this.retryPayload = null;
    this.activeServerConversationId = null;
    this.state.set({
      conversationId: null,
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
    this.state.update((state) => ({ ...state, loadingConversation: true, error: null }));

    try {
      const result = await this.repository.getConversation(conversationId);
      if (!result) {
        this.activeServerConversationId = null;
        this.state.update((state) => ({ ...state, loadingConversation: false }));
        return false;
      }

      this.retryPayload = null;
      this.activeServerConversationId = conversationId;
      this.state.update((state) => ({
        ...state,
        conversationId,
        messages: result.messages,
        loadingConversation: false,
        retryAvailable: false,
      }));

      return true;
    } catch {
      this.activeServerConversationId = null;
      this.state.update((state) => ({
        ...state,
        loadingConversation: false,
        error: '讀取口說歷史失敗，請稍後再試',
      }));
      return false;
    }
  }

  async sendAudioMessage(audioBlob: Blob): Promise<void> {
    if (this.state().sending || !audioBlob || audioBlob.size === 0) {
      return;
    }

    const currentState = this.state();
    const localConversationId = currentState.conversationId ?? createSpeakingId();
    const historyBefore = [...currentState.messages];

    const normalizedAudioBlob = await this.safeConvertToWav(audioBlob);
    const userMessageId = createSpeakingId();
    const userMessage: SpeakingMessage = {
      id: userMessageId,
      conversationId: localConversationId,
      role: 'user',
      text: '',
      audioMimeType: normalizedAudioBlob.type || 'audio/wav',
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...historyBefore, userMessage];

    this.state.update((state) => ({
      ...state,
      conversationId: localConversationId,
      messages: nextMessages,
      sending: true,
      error: null,
      retryAvailable: false,
    }));

    this.retryPayload = {
      localConversationId,
      requestConversationId: this.activeServerConversationId ?? undefined,
      userMessage,
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
      const summaryText = response.data.summary.trim();

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
      const response = await firstValueFrom(
        this.speakingApi.createSpeakingAudioReply(
          payload.audioBlob,
          payload.requestConversationId,
          settings.voice,
          settings.systemPrompt.trim() || undefined,
          settings.memory.trim() || undefined,
          settings.autoMemoryEnabled ? 'true' : 'false',
          undefined,
          undefined,
          { context: this.skipLoadingContext },
        ),
      );

      const transcript = response.data.transcript.trim();
      if (!transcript) {
        throw new Error('assistant transcript empty');
      }

      const serverConversationId = response.data.conversationId?.trim();
      if (!serverConversationId) {
        throw new Error('conversationId missing');
      }

      const userAudioKey = await this.repository.saveAudioBlob({
        conversationId: serverConversationId,
        messageId: payload.userMessage.id,
        blob: payload.audioBlob,
        mimeType: payload.audioBlob.type,
        audioKey: `${payload.userMessage.id}:audio`,
      });

      const assistantMessageId = createSpeakingId();
      const assistantAudioBlob = base64ToBlob(response.data.audioBase64);
      const assistantAudioKey = await this.repository.saveAudioBlob({
        conversationId: serverConversationId,
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
        conversationId: serverConversationId,
        role: 'assistant',
        text: transcript,
        translatedText,
        audioBlobKey: assistantAudioKey,
        audioMimeType: assistantAudioBlob.type || 'audio/wav',
        createdAt: new Date().toISOString(),
        usage: response.data.usage,
      };

      const stateMessages = this.state().messages;
      const updatedUserMessage: SpeakingMessage = {
        ...payload.userMessage,
        conversationId: serverConversationId,
        audioBlobKey: userAudioKey,
        audioMimeType: payload.audioBlob.type || payload.userMessage.audioMimeType || 'audio/wav',
      };

      const userExists = stateMessages.some((item) => item.id === payload.userMessage.id);
      const ensuredMessages = userExists
        ? stateMessages.map((item) =>
            item.id === payload.userMessage.id ? updatedUserMessage : item,
          )
        : [...stateMessages, updatedUserMessage];

      const normalizedMessages = ensuredMessages.map((message) =>
        message.conversationId === payload.localConversationId
          ? {
              ...message,
              conversationId: serverConversationId,
            }
          : message,
      );

      const nextMessages = [...normalizedMessages, assistantMessage];
      this.activeServerConversationId = serverConversationId;

      this.state.update((state) => ({
        ...state,
        conversationId: serverConversationId,
        messages: nextMessages,
        sending: false,
        retryAvailable: false,
        error: null,
      }));

      await this.repository.saveMessages(nextMessages);
      await this.persistConversation(serverConversationId, nextMessages);
      await this.repository.enforceConversationStorageLimit(
        SPEAKING_HISTORY_LIMIT_BYTES,
        serverConversationId,
      );

      if (response.data.memoryUpdate?.memory?.trim()) {
        const nextSettings: SpeakingSettings = {
          ...settings,
          memory: response.data.memoryUpdate.memory.trim(),
        };
        this.repository.saveSettings(nextSettings);
        this.speakingSettingsState.set(nextSettings);
      }

      if (settings.autoPlayVoice) {
        await this.audioPlayer.play(assistantAudioBlob, assistantAudioKey, { auto: true });
      }

      this.retryPayload = null;
      return true;
    } catch (error) {
      if (this.isSessionExpiredError(error)) {
        const restartedConversationId = createSpeakingId();
        const restartedUserMessage: SpeakingMessage = {
          ...payload.userMessage,
          conversationId: restartedConversationId,
          audioBlobKey: undefined,
        };

        payload.localConversationId = restartedConversationId;
        payload.requestConversationId = undefined;
        payload.userMessage = restartedUserMessage;

        this.activeServerConversationId = null;
        this.state.update((state) => ({
          ...state,
          conversationId: restartedConversationId,
          messages: [restartedUserMessage],
          sending: false,
          retryAvailable: true,
          error: '口說會話已過期，已切換新會話，請按重試重新送出剛剛的錄音。',
        }));
        return false;
      }

      this.state.update((state) => ({
        ...state,
        sending: false,
        error: this.resolveSpeakingErrorMessage(error),
      }));
      return false;
    }
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

  private isSessionExpiredError(error: unknown): boolean {
    const httpError = error as HttpErrorResponse | undefined;
    return (
      httpError?.status === 409 && this.extractApiErrorCode(error) === 'SPEAKING_SESSION_EXPIRED'
    );
  }

  private extractApiErrorCode(error: unknown): string | null {
    const httpError = error as HttpErrorResponse | undefined;
    if (!httpError?.error || typeof httpError.error !== 'object') {
      return null;
    }

    const errorPayload = httpError.error as { error?: { code?: unknown } };
    const code = errorPayload.error?.code;
    return typeof code === 'string' ? code : null;
  }

  private resolveSpeakingErrorMessage(error: unknown): string {
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

    if (status === 409 && this.extractApiErrorCode(error) === 'SPEAKING_SESSION_EXPIRED') {
      return '口說會話已過期，請點擊重試以建立新會話。';
    }

    if (status === 0) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return '目前離線，請確認網路後重試。';
      }
      return '無法連線到語音服務，請確認 API 是否啟動、CORS 與 HTTPS/HTTP 設定後重試。';
    }

    return '語音口說請求失敗，請點擊重試。';
  }
}
