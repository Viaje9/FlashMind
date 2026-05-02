import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { CollectionSuggestionCardComponent } from '../../components/collection-pack/collection-suggestion-card.component';
import { type CollectionSuggestion } from '../../components/collection-pack/collection-pack.domain';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';

@Component({
  selector: 'app-collection-pack-new-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FmButtonComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    CollectionSuggestionCardComponent,
  ],
  templateUrl: './collection-pack-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPackNewComponent {
  private readonly router = inject(Router);
  readonly store = inject(CollectionPackStore);
  readonly inputControl = new FormControl('如果我要說「我想延期會議」呢？', {
    nonNullable: true,
  });
  readonly inputValue = signal(this.inputControl.value);

  constructor() {
    this.inputControl.valueChanges.subscribe((value) => this.inputValue.set(value));
  }

  onSubmit(): void {
    const value = this.inputValue().trim();
    if (!value) return;

    this.store.appendMockChat(value);
    this.inputControl.setValue('');
    setTimeout(() => {
      const suggestions = document.querySelectorAll('app-collection-suggestion-card');
      const lastSuggestion = suggestions.item(suggestions.length - 1);
      if (
        lastSuggestion instanceof HTMLElement &&
        typeof lastSuggestion.scrollIntoView === 'function'
      ) {
        lastSuggestion.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  onToggleSuggestion(groupId: string, suggestion: CollectionSuggestion): void {
    if (suggestion.added) {
      this.store.removeSuggestion(groupId, suggestion.id);
      return;
    }

    this.store.addSuggestion(groupId, suggestion.id);
  }

  onHeaderTitleClick(): void {
    void this.router.navigate(['/collections']);
  }
}
