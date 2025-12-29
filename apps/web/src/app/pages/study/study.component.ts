import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FmIconButtonComponent,
  FmPageHeaderComponent,
  FmStudyCardComponent,
  FmStudyDecisionBarComponent,
  FmStudyProgressComponent,
  StudyExample
} from '../../../../../../packages/ui/src/index';

@Component({
  selector: 'app-study-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmStudyProgressComponent,
    FmStudyCardComponent,
    FmStudyDecisionBarComponent
  ],
  templateUrl: './study.component.html',
  styleUrl: './study.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudyComponent {
  readonly word = 'Hello';
  readonly translations = ['你好', '喂'];
  readonly examples: StudyExample[] = [
    {
      label: '你好',
      sentence: 'Hello, how are you today?',
      translation: '你今天好嗎？'
    },
    {
      label: '喂',
      sentence: 'Hello? Is anyone there?',
      translation: '喂？有人在嗎？'
    }
  ];
}
