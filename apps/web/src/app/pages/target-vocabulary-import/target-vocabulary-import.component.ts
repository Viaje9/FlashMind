import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ImportTargetVocabularyResult, TargetVocabularyService } from '@flashmind/api-client';
import { FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';

import {
  ParsedTargetVocabularyWord,
  parseTargetVocabularyImportJson,
} from '../../components/target-vocabulary/target-vocabulary.domain';

type ImportStep = 'input' | 'preview' | 'result';

@Component({
  selector: 'app-target-vocabulary-import-page',
  imports: [RouterLink, FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent],
  templateUrl: './target-vocabulary-import.component.html',
  styleUrl: './target-vocabulary-import.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TargetVocabularyImportComponent {
  private readonly api = inject(TargetVocabularyService);
  private readonly router = inject(Router);

  readonly step = signal<ImportStep>('input');
  readonly jsonInput = signal('');
  readonly words = signal<ParsedTargetVocabularyWord[]>([]);
  readonly parseError = signal('');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly result = signal<ImportTargetVocabularyResult | null>(null);

  readonly validWords = computed(() => this.words().filter((word) => !word.error));
  readonly invalidWords = computed(() => this.words().filter((word) => !!word.error));
  readonly canPreview = computed(() => this.words().length > 0 && !this.parseError());
  readonly canImport = computed(() => this.validWords().length > 0 && !this.importing());

  readonly exampleJson = JSON.stringify(
    {
      words: [
        { term: 'cooperation', zhMeaning: '合作；協作' },
        { term: 'figure out', zhMeaning: '弄清楚' },
      ],
    },
    null,
    2,
  );

  onJsonInput(event: Event): void {
    this.setInput((event.target as HTMLTextAreaElement).value);
  }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.setInput(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  }

  copyExample(): void {
    void navigator.clipboard.writeText(this.exampleJson);
  }

  showPreview(): void {
    if (this.canPreview()) this.step.set('preview');
  }

  backToInput(): void {
    this.step.set('input');
    this.importError.set('');
  }

  importWords(): void {
    if (!this.canImport()) return;
    this.importing.set(true);
    this.importError.set('');
    this.api
      .importTargetVocabulary({
        words: this.validWords().map(({ term, zhMeaning }) => ({ term, zhMeaning })),
      })
      .subscribe({
        next: ({ data }) => {
          this.result.set(data);
          this.step.set('result');
          this.importing.set(false);
        },
        error: () => {
          this.importError.set('匯入失敗，請稍後再試');
          this.importing.set(false);
        },
      });
  }

  finish(): void {
    void this.router.navigate(['/target-vocabulary']);
  }

  private setInput(value: string): void {
    this.jsonInput.set(value);
    const parsed = parseTargetVocabularyImportJson(value);
    this.words.set(parsed.words);
    this.parseError.set(parsed.error ?? '');
  }
}
