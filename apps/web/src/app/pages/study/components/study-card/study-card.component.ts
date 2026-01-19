import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface StudyExample {
  label: string;
  sentence: string;
  translation: string;
}

@Component({
  selector: 'fm-study-card',
  templateUrl: './study-card.component.html',
  styleUrl: './study-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmStudyCardComponent {
  readonly word = input('');
  readonly translations = input<string[]>([]);
  readonly examples = input<StudyExample[]>([]);
  readonly showActions = input(true);
  readonly wordAudioLoading = input(false);
  readonly exampleAudioLoadingIndex = input<number | null>(null);

  readonly bookmarkClick = output<void>();
  readonly audioClick = output<void>();
  readonly exampleAudioClick = output<number>();

  readonly hasExamples = computed(() => this.examples().length > 0);
  readonly hasTranslations = computed(() => this.translations().length > 0);
  readonly translationText = computed(() => this.translations().join('；'));

  isExampleLoading(index: number): boolean {
    return this.exampleAudioLoadingIndex() === index;
  }

  onExampleAudioClick(index: number) {
    this.exampleAudioClick.emit(index);
  }
}
