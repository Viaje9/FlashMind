import { computed, inject, Injectable, signal } from '@angular/core';
import { AIService, GeneratedMeaning } from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import { mapGeneratedMeaningsToCardMeanings } from './ai.domain';
import type { CardMeaningDraft } from '../card/card.domain';

export interface AiStoreState {
  generating: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiStore {
  private readonly aiService = inject(AIService);

  private readonly state = signal<AiStoreState>({
    generating: false,
    error: null,
  });

  readonly generating = computed(() => this.state().generating);
  readonly error = computed(() => this.state().error);

  async generateCardContent(text: string): Promise<CardMeaningDraft[] | null> {
    this.state.update((s) => ({ ...s, generating: true, error: null }));

    try {
      const response = await firstValueFrom(
        this.aiService.generateCardContent({ text }),
      );
      this.state.update((s) => ({ ...s, generating: false }));
      return mapGeneratedMeaningsToCardMeanings(response.data.meanings);
    } catch (err) {
      this.state.update((s) => ({
        ...s,
        generating: false,
        error: 'AI 生成失敗，請稍後再試',
      }));
      return null;
    }
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }
}
