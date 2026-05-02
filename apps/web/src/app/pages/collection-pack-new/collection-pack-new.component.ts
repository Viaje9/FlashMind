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
  readonly inputControl = new FormControl('', {
    nonNullable: true,
  });
  readonly inputValue = signal(this.inputControl.value);

  constructor() {
    this.inputControl.valueChanges.subscribe((value) => this.inputValue.set(value));
  }

  async onSubmit(): Promise<void> {
    const value = this.inputValue().trim();
    if (!value) return;

    const sendMessage = this.store.sendChatMessage(value);
    this.inputControl.setValue('');
    setTimeout(() => this.scrollChatBottom());
    await sendMessage;
    this.scrollToLastSuggestion();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) {
      return;
    }

    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    void this.onSubmit();
  }

  private scrollChatBottom(): void {
    const bottom = document.querySelector('[data-collection-chat-bottom]');
    if (bottom instanceof HTMLElement && typeof bottom.scrollIntoView === 'function') {
      bottom.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }

  private scrollToLastSuggestion(): void {
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

  async onToggleSuggestion(groupId: string, suggestion: CollectionSuggestion): Promise<void> {
    if (suggestion.added) {
      await this.store.removeSuggestion(groupId, suggestion.id);
      return;
    }

    await this.store.addSuggestion(groupId, suggestion.id);
  }

  onStartNewChat(): void {
    this.store.startNewChat();
    this.inputControl.setValue('');
  }

  onHeaderTitleClick(): void {
    void this.router.navigate(['/collections']);
  }
}
