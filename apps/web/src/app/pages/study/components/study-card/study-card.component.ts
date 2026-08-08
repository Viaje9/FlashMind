import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { RelatedExample } from '@flashmind/api-client';

export interface StudyExample {
  label: string;
  sentence: string;
  translation: string;
}

interface RelatedExampleSegment {
  text: string;
  status: 'unfamiliar' | 'learning' | 'normal';
}

@Component({
  selector: 'fm-study-card',
  templateUrl: './study-card.component.html',
  styleUrl: './study-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmStudyCardComponent {
  readonly word = input('');
  readonly translations = input<string[]>([]);
  readonly examples = input<StudyExample[]>([]);
  readonly showActions = input(true);
  readonly wordAudioLoading = input(false);
  readonly exampleAudioLoadingIndex = input<number | null>(null);
  readonly relatedExample = input<RelatedExample | null>(null);
  readonly relatedExampleAudioLoading = input(false);
  readonly relatedExampleLoading = input(false);
  readonly relatedExampleSaving = input(false);
  readonly relatedExampleError = input<string | null>(null);

  readonly bookmarkClick = output<void>();
  readonly audioClick = output<void>();
  readonly exampleAudioClick = output<number>();
  readonly relatedExampleAudioClick = output<void>();
  readonly relatedExampleGenerate = output<void>();
  readonly relatedExampleRegenerate = output<void>();
  readonly relatedExampleConfirm = output<void>();
  readonly relatedExampleCancel = output<void>();

  readonly hasExamples = computed(() => this.examples().length > 0);
  readonly hasTranslations = computed(() => this.translations().length > 0);
  readonly translationText = computed(() => this.translations().join('；'));
  readonly relatedExampleSegments = computed<RelatedExampleSegment[]>(() => {
    const example = this.relatedExample();
    if (!example) return [];

    const unfamiliarWords = new Set(
      example.unfamiliarWords.map((word) => this.normalizeWord(word)),
    );
    const learningWords = new Set(example.learningWords.map((word) => this.normalizeWord(word)));
    return example.enExample.split(/([A-Za-z]+(?:[-'][A-Za-z]+)*)/g).map((text) => ({
      text,
      status: /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(text)
        ? unfamiliarWords.has(this.normalizeWord(text))
          ? 'unfamiliar'
          : learningWords.has(this.normalizeWord(text))
            ? 'learning'
            : 'normal'
        : 'normal',
    }));
  });

  isExampleLoading(index: number): boolean {
    return this.exampleAudioLoadingIndex() === index;
  }

  onExampleAudioClick(index: number) {
    this.exampleAudioClick.emit(index);
  }

  private normalizeWord(word: string): string {
    return word
      .toLocaleLowerCase('en-US')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9-]/g, '');
  }
}
