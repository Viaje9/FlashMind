import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TargetVocabularyItem, TargetVocabularyService } from '@flashmind/api-client';
import { DialogService, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';

import {
  filterTargetVocabulary,
  getTargetVocabularyBackNavigation,
  getTargetVocabularyStatusCounts,
  parseTargetVocabularyFilterPreference,
  TargetVocabularyFilter,
} from '../../components/target-vocabulary/target-vocabulary.domain';
import { TtsStore } from '../../components/tts/tts.store';
import {
  AddToDeckDialogComponent,
  type AddToDeckDialogData,
} from './components/add-to-deck-dialog/add-to-deck-dialog.component';

const TARGET_VOCABULARY_FILTER_STORAGE_KEY = 'flashmind.target-vocabulary.filter';

@Component({
  selector: 'app-target-vocabulary-page',
  imports: [RouterLink, FmPageHeaderComponent, FmIconButtonComponent],
  templateUrl: './target-vocabulary.component.html',
  styleUrl: './target-vocabulary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TargetVocabularyComponent implements OnInit {
  private readonly api = inject(TargetVocabularyService);
  private readonly dialogService = inject(DialogService);
  private readonly ttsStore = inject(TtsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly items = signal<TargetVocabularyItem[]>([]);
  readonly activeFilter = signal<TargetVocabularyFilter>(this.loadFilterPreference());
  readonly query = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly ttsError = this.ttsStore.error;
  readonly backNavigation = getTargetVocabularyBackNavigation(
    this.route.snapshot.queryParamMap.get('from'),
    this.route.snapshot.queryParamMap.get('conversationId'),
  );

  readonly counts = computed(() => getTargetVocabularyStatusCounts(this.items()));
  readonly visibleItems = computed(() =>
    filterTargetVocabulary(this.items(), this.activeFilter(), this.query()),
  );

  readonly filters: ReadonlyArray<{ value: TargetVocabularyFilter; label: string }> = [
    { value: 'UNSEEN', label: '待接觸' },
    { value: 'PRACTICING', label: '待練習' },
    { value: 'USED', label: '已使用' },
    { value: 'ADDED', label: '已加入' },
  ];

  ngOnInit(): void {
    this.loadWords();
  }

  setFilter(filter: TargetVocabularyFilter): void {
    this.activeFilter.set(filter);
    this.saveFilterPreference(filter);
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  onPlayWordAudio(text: string): void {
    if (!text.trim()) return;
    void this.ttsStore.playWord(text);
  }

  onPlaySentenceAudio(text: string): void {
    if (!text.trim()) return;
    void this.ttsStore.play(text);
  }

  isAudioPlaying(text: string): boolean {
    return this.ttsStore.isPlaying(text.trim());
  }

  isAudioLoading(text: string): boolean {
    return this.ttsStore.isLoading(text.trim());
  }

  clearTtsError(): void {
    this.ttsStore.clearError();
  }

  onBack(): void {
    void this.router.navigate([this.backNavigation.route], {
      queryParams: this.backNavigation.queryParams,
    });
  }

  openAddToDeck(item: TargetVocabularyItem): void {
    const dialogRef = this.dialogService.open<
      AddToDeckDialogComponent,
      AddToDeckDialogData,
      TargetVocabularyItem
    >(AddToDeckDialogComponent, {
      data: { item },
      maxWidth: '32rem',
      closeOnBackdropClick: false,
      ariaLabel: `將 ${item.term} 加入牌組`,
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (!updated) return;
      this.items.update((items) =>
        items.map((current) => (current.id === updated.id ? updated : current)),
      );
      this.setFilter('ADDED');
      this.notice.set(`${updated.term} 已加入牌組`);
    });
  }

  private loadFilterPreference(): TargetVocabularyFilter {
    if (typeof localStorage === 'undefined') return 'UNSEEN';

    try {
      return parseTargetVocabularyFilterPreference(
        localStorage.getItem(TARGET_VOCABULARY_FILTER_STORAGE_KEY),
      );
    } catch {
      return 'UNSEEN';
    }
  }

  private saveFilterPreference(filter: TargetVocabularyFilter): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(TARGET_VOCABULARY_FILTER_STORAGE_KEY, filter);
    } catch {
      // localStorage 在私密瀏覽或容量受限時可能不可用。
    }
  }

  private loadWords(): void {
    this.loading.set(true);
    this.api.listTargetVocabulary().subscribe({
      next: ({ data }) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('目標單字載入失敗，請稍後再試');
        this.loading.set(false);
      },
    });
  }
}
