import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import { renderAssistantMarkdown } from './assistant-markdown.domain';

@Component({
  selector: 'app-assistant-markdown',
  template: `<div class="assistant-markdown" [innerHTML]="html()"></div>`,
  styleUrl: './assistant-markdown.component.css',
  // Markdown 內文由 Angular sanitization 處理，樣式限定於 assistant-markdown。
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantMarkdownComponent {
  readonly content = input.required<string>();
  readonly html = computed(() => renderAssistantMarkdown(this.content()));
}
