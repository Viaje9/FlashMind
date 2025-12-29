import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FmAddItemButtonComponent,
  FmButtonComponent,
  FmFormSectionHeaderComponent,
  FmGlowTextareaComponent,
  FmMeaningEditorCardComponent,
  FmPageHeaderComponent,
  MeaningDraft
} from '../../../../../../packages/ui/src/index';

interface MeaningBlock {
  id: string;
  label: string;
  data: MeaningDraft;
}

@Component({
  selector: 'app-card-editor-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmFormSectionHeaderComponent,
    FmGlowTextareaComponent,
    FmMeaningEditorCardComponent,
    FmAddItemButtonComponent
  ],
  templateUrl: './card-editor.component.html',
  styleUrl: './card-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardEditorComponent {
  readonly frontText = 'Hello';

  readonly meaningBlocks: MeaningBlock[] = [
    {
      id: 'meaning-1',
      label: '你好',
      data: {
        zhMeaning: '你好',
        enExample: 'Hello, how are you today?',
        zhExample: '你好，你今天好嗎？'
      }
    },
    {
      id: 'meaning-2',
      label: '喂',
      data: {
        zhMeaning: '（打電話時的招呼語）喂',
        enExample: 'Hello? Is anyone there?',
        zhExample: '喂？有人在嗎？'
      }
    }
  ];
}
