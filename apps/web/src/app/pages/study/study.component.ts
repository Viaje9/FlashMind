import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { FmStudyCardComponent, StudyExample } from '../../components/study/study-card/study-card.component';
import { FmStudyDecisionBarComponent } from '../../components/study/study-decision-bar/study-decision-bar.component';
import { FmStudyProgressComponent } from '../../components/study/study-progress/study-progress.component';

@Component({
  selector: 'app-study-page',
  imports: [
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmStudyProgressComponent,
    FmStudyCardComponent,
    FmStudyDecisionBarComponent,
    RouterLink
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
