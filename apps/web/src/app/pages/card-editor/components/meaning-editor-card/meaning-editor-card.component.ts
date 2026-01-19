import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface MeaningDraft {
  zhMeaning: string;
  enExample: string;
  zhExample: string;
}

@Component({
  selector: 'fm-meaning-editor-card',
  templateUrl: './meaning-editor-card.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmMeaningEditorCardComponent {
  readonly meaning = input<MeaningDraft>({ zhMeaning: '', enExample: '', zhExample: '' });
  readonly tagLabel = input('');
  readonly showDelete = input(true);
  readonly testId = input<string>();
  readonly isPlayingAudio = input(false);

  readonly meaningChange = output<MeaningDraft>();
  readonly deleteClick = output<void>();
  readonly playAudioClick = output<void>();

  onFieldChange(field: keyof MeaningDraft, value: string) {
    const nextValue = {
      ...this.meaning(),
      [field]: value
    };
    this.meaningChange.emit(nextValue);
  }

  onInputChange(event: Event, field: keyof MeaningDraft) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.onFieldChange(field, target.value);
  }
}
