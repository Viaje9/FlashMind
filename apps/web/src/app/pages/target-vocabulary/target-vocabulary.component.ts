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
import {
  DialogService,
  FmConfirmDialogComponent,
  FmIconButtonComponent,
  FmPageHeaderComponent,
} from '@flashmind/ui';

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
  readonly rejectingId = signal<string | null>(null);
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

  rejectActualUse(item: TargetVocabularyItem): void {
    if (item.status !== 'USED' || this.rejectingId()) return;

    const confirmMessage =
      item.useCount > 1
        ? `${item.term} 有 ${item.useCount} 次 Speaking 使用記錄，移除後會全部清除。確定不是你使用過的單字嗎？`
        : `確定要將 ${item.term} 從「已使用」移除嗎？這會清除目前的使用情境與自然句子。`;
    const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
      data: {
        title: '移除已使用判定',
        message: confirmMessage,
        confirmText: '確定移除',
        cancelText: '取消',
      },
      ariaLabel: `將 ${item.term} 從已使用移除`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.performRejectActualUse(item);
    });
  }

  private performRejectActualUse(item: TargetVocabularyItem): void {
    this.rejectingId.set(item.id);
    this.error.set('');
    this.notice.set('');
    this.api.rejectTargetVocabularyUse(item.id).subscribe({
      next: ({ data: updated }) => {
        this.items.update((items) =>
          items.map((current) => (current.id === updated.id ? updated : current)),
        );
        this.notice.set(
          `${updated.term} 已移回${updated.status === 'PRACTICING' ? '待練習' : '待接觸'}`,
        );
        this.rejectingId.set(null);
      },
      error: () => {
        this.error.set('移除已使用判定失敗，請稍後再試');
        this.rejectingId.set(null);
      },
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
