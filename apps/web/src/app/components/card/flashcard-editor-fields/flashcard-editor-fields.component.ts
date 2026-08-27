import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FmAddItemButtonComponent } from '@flashmind/ui';
import {
  FmMeaningEditorCardComponent,
  type MeaningDraft,
} from '../../../pages/card-editor/components/meaning-editor-card/meaning-editor-card.component';

@Component({
  selector: 'app-flashcard-editor-fields',
  imports: [FmAddItemButtonComponent, FmMeaningEditorCardComponent],
  templateUrl: './flashcard-editor-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashcardEditorFieldsComponent {
  readonly front = input.required<string>();
  readonly meanings = input.required<MeaningDraft[]>();
  readonly showAiGenerate = input(false);
  readonly aiGenerating = input(false);
  readonly canAiGenerate = input(false);
  readonly showTranslate = input(false);
  readonly showAddMeaning = input(true);
  readonly translatingIndex = input<number | null>(null);
  readonly playingText = input<string | null>(null);

  readonly frontChange = output<string>();
  readonly meaningChange = output<{ index: number; meaning: MeaningDraft }>();
  readonly deleteMeaning = output<number>();
  readonly addMeaning = output<void>();
  readonly aiGenerate = output<void>();
  readonly playSentence = output<string>();
  readonly translateSentence = output<number>();

  onFrontInput(event: Event): void {
    this.frontChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
