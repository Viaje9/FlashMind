import { Injectable } from '@angular/core';
import { blobToBase64 } from './speaking-audio.utils';
import {
  SPEAKING_DEFAULT_SETTINGS,
  type SpeakingConversation,
  type SpeakingMessage,
  type SpeakingSettings,
} from './speaking.domain';

const DB_NAME = 'flashmind-speaking-db';
const DB_VERSION = 2;
const CONVERSATION_STORE = 'speaking_conversations';
const MESSAGE_STORE = 'speaking_messages';
const AUDIO_STORE = 'speaking_audio';
const SETTINGS_STORAGE_KEY = 'flashmind.settings.speaking';

interface SpeakingAudioRecord {
  id: string;
  conversationId: string;
  messageId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SpeakingRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async listConversations(): Promise<SpeakingConversation[]> {
    if (!this.isIndexedDbAvailable()) {
      return [];
    }

    const db = await this.openDb();
    const conversations = await this.requestToPromise<SpeakingConversation[]>(
      db.transaction(CONVERSATION_STORE, 'readonly').objectStore(CONVERSATION_STORE).getAll(),
    );

    return [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getConversation(
    conversationId: string,
  ): Promise<{ conversation: SpeakingConversation; messages: SpeakingMessage[] } | null> {
    if (!this.isIndexedDbAvailable()) {
      return null;
    }

    const db = await this.openDb();
    const conversation = await this.requestToPromise<SpeakingConversation | undefined>(
      db
        .transaction(CONVERSATION_STORE, 'readonly')
        .objectStore(CONVERSATION_STORE)
        .get(conversationId),
    );

    if (!conversation) {
      return null;
    }

    const messages = await this.listMessages(conversationId);
    return { conversation, messages };
  }

  async listMessages(conversationId: string): Promise<SpeakingMessage[]> {
    if (!this.isIndexedDbAvailable()) {
      return [];
    }

    const db = await this.openDb();
    const store = db.transaction(MESSAGE_STORE, 'readonly').objectStore(MESSAGE_STORE);
    const index = store.index('byConversationId');

    const records = await this.requestToPromise<SpeakingMessage[]>(
      index.getAll(IDBKeyRange.only(conversationId)),
    );

    return records
      .map((item) => ({
        ...item,
        audioBase64: undefined,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveConversation(conversation: SpeakingConversation): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      return;
    }

    const db = await this.openDb();
    const tx = db.transaction(CONVERSATION_STORE, 'readwrite');
    tx.objectStore(CONVERSATION_STORE).put(conversation);
    await this.transactionDone(tx);
  }

  async saveMessage(message: SpeakingMessage): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      return;
    }

    const db = await this.openDb();
    const tx = db.transaction(MESSAGE_STORE, 'readwrite');
    tx.objectStore(MESSAGE_STORE).put(this.toPersistedMessage(message));
    await this.transactionDone(tx);
  }

  async saveMessages(messages: SpeakingMessage[]): Promise<void> {
    if (!this.isIndexedDbAvailable() || messages.length === 0) {
      return;
    }

    const db = await this.openDb();
    const tx = db.transaction(MESSAGE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_STORE);

    for (const message of messages) {
      store.put(this.toPersistedMessage(message));
    }

    await this.transactionDone(tx);
  }

  async saveAudioBlob(input: {
    conversationId: string;
    messageId: string;
    blob: Blob;
    mimeType?: string;
    audioKey?: string;
  }): Promise<string> {
    if (!this.isIndexedDbAvailable()) {
      return '';
    }

    const audioKey = input.audioKey ?? `${input.messageId}:audio`;

    const record: SpeakingAudioRecord = {
      id: audioKey,
      conversationId: input.conversationId,
      messageId: input.messageId,
      blob: input.blob,
      mimeType: (input.mimeType ?? input.blob.type) || 'audio/wav',
      size: input.blob.size,
      createdAt: new Date().toISOString(),
    };

    const db = await this.openDb();
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).put(record);
    await this.transactionDone(tx);

    return audioKey;
  }

  async getAudioBlob(audioKey: string): Promise<Blob | null> {
    if (!this.isIndexedDbAvailable()) {
      return null;
    }

    const db = await this.openDb();
    const record = await this.requestToPromise<SpeakingAudioRecord | undefined>(
      db.transaction(AUDIO_STORE, 'readonly').objectStore(AUDIO_STORE).get(audioKey),
    );

    return record?.blob ?? null;
  }

  async getAudioBase64(audioKey: string): Promise<string | null> {
    const blob = await this.getAudioBlob(audioKey);
    if (!blob) {
      return null;
    }

    try {
      return await blobToBase64(blob);
    } catch {
      return null;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      return;
    }

    const db = await this.openDb();
    const tx = db.transaction([CONVERSATION_STORE, MESSAGE_STORE, AUDIO_STORE], 'readwrite');
    const conversationStore = tx.objectStore(CONVERSATION_STORE);
    const messageStore = tx.objectStore(MESSAGE_STORE);
    const audioStore = tx.objectStore(AUDIO_STORE);

    const messages = await this.requestToPromise<SpeakingMessage[]>(
      messageStore.index('byConversationId').getAll(IDBKeyRange.only(conversationId)),
    );

    for (const message of messages) {
      messageStore.delete(message.id);
      if (message.audioBlobKey) {
        audioStore.delete(message.audioBlobKey);
      }
    }

    const audioRecords = await this.requestToPromise<SpeakingAudioRecord[]>(
      audioStore.index('byConversationId').getAll(IDBKeyRange.only(conversationId)),
    );

    for (const audio of audioRecords) {
      audioStore.delete(audio.id);
    }

    conversationStore.delete(conversationId);
    await this.transactionDone(tx);
  }

  async enforceConversationStorageLimit(
    limitBytes: number,
    protectedConversationId?: string,
  ): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      return;
    }

    let total = await this.getAudioUsageBytes();
    if (total <= limitBytes) {
      return;
    }

    const conversations = await this.listConversations();
    const candidates = [...conversations]
      .filter((item) => item.id !== protectedConversationId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

    for (const conversation of candidates) {
      if (total <= limitBytes) {
        break;
      }

      await this.deleteConversation(conversation.id);
      total = await this.getAudioUsageBytes();
    }
  }

  loadSettings(): SpeakingSettings {
    if (typeof localStorage === 'undefined') {
      return SPEAKING_DEFAULT_SETTINGS;
    }

    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        return SPEAKING_DEFAULT_SETTINGS;
      }

      const parsed = JSON.parse(raw) as Partial<SpeakingSettings>;

      return {
        autoPlayVoice: parsed.autoPlayVoice ?? SPEAKING_DEFAULT_SETTINGS.autoPlayVoice,
        showTranscript: parsed.showTranscript ?? SPEAKING_DEFAULT_SETTINGS.showTranscript,
        autoTranslate: parsed.autoTranslate ?? SPEAKING_DEFAULT_SETTINGS.autoTranslate,
        systemPrompt: parsed.systemPrompt ?? SPEAKING_DEFAULT_SETTINGS.systemPrompt,
        voice: parsed.voice ?? SPEAKING_DEFAULT_SETTINGS.voice,
        memory: parsed.memory ?? SPEAKING_DEFAULT_SETTINGS.memory,
        autoMemoryEnabled: parsed.autoMemoryEnabled ?? SPEAKING_DEFAULT_SETTINGS.autoMemoryEnabled,
      };
    } catch {
      return SPEAKING_DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: SpeakingSettings): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }

  private async getAudioUsageBytes(): Promise<number> {
    const db = await this.openDb();
    const audioRecords = await this.requestToPromise<SpeakingAudioRecord[]>(
      db.transaction(AUDIO_STORE, 'readonly').objectStore(AUDIO_STORE).getAll(),
    );

    return audioRecords.reduce((sum, item) => sum + (item.size || item.blob.size || 0), 0);
  }

  private toPersistedMessage(message: SpeakingMessage): SpeakingMessage {
    return {
      ...message,
      audioBase64: undefined,
    };
  }

  private isIndexedDbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = () => {
          const db = request.result;

          if (!db.objectStoreNames.contains(CONVERSATION_STORE)) {
            const conversationStore = db.createObjectStore(CONVERSATION_STORE, { keyPath: 'id' });
            conversationStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
            const messageStore = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
            messageStore.createIndex('byConversationId', 'conversationId', { unique: false });
            messageStore.createIndex('byCreatedAt', 'createdAt', { unique: false });
          }

          if (!db.objectStoreNames.contains(AUDIO_STORE)) {
            const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
            audioStore.createIndex('byConversationId', 'conversationId', { unique: false });
          }
        };
      });
    }

    return this.dbPromise;
  }

  private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
