import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import type {
  CollectionItem,
  CollectionSuggestion,
} from '../../components/collection-pack/collection-pack.domain';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';

@Component({
  selector: 'app-collection-pack-edit-page',
  imports: [RouterLink, FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent],
  templateUrl: './collection-pack-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPackEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(CollectionPackStore);

  readonly item = signal<CollectionItem | null>(null);
  readonly text = signal('');
  readonly meaning = signal('');
  readonly prompt = signal('');
  readonly suggestion = signal<CollectionSuggestion | null>(null);
  readonly loading = signal(true);
  readonly prompting = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);

  constructor() {
    void this.loadItem();
  }

  async onPrompt(): Promise<void> {
    const item = this.item();
    const prompt = this.prompt().trim();
    if (!item || !prompt || this.prompting()) return;

    this.prompting.set(true);
    this.suggestion.set(await this.store.suggestSentenceEdit(item, prompt));
    this.prompting.set(false);
  }

  applySuggestion(): void {
    const suggestion = this.suggestion();
    if (!suggestion) return;

    this.text.set(suggestion.text);
    this.meaning.set(suggestion.meaning);
    this.suggestion.set(null);
    this.saved.set(false);
  }

  async onSave(): Promise<void> {
    const item = this.item();
    if (!item || !this.text().trim() || this.saving()) return;

    this.saving.set(true);
    const updated = await this.store.updateItem(item.id, this.text(), this.meaning());
    this.saving.set(false);

    if (updated) {
      this.item.set(updated);
      this.text.set(updated.text);
      this.meaning.set(updated.meaning);
      this.saved.set(true);
    }
  }

  onHeaderTitleClick(): void {
    void this.router.navigate(['/collections']);
  }

  private async loadItem(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }

    const item = await this.store.getItem(id);
    this.item.set(item);
    this.text.set(item?.text ?? '');
    this.meaning.set(item?.meaning ?? '');
    this.loading.set(false);
  }
}
