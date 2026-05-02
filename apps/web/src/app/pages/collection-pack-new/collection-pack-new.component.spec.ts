import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionPackStore } from '../../components/collection-pack/collection-pack.store';
import { CollectionPackNewComponent } from './collection-pack-new.component';

describe('CollectionPackNewComponent', () => {
  let component: CollectionPackNewComponent;
  let store: CollectionPackStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CollectionPackStore,
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    });

    store = TestBed.inject(CollectionPackStore);
    component = TestBed.runInInjectionContext(() => new CollectionPackNewComponent());
  });

  it('送出文字後應追加 mock 對話與建議', () => {
    component.inputControl.setValue('我想延期會議');

    component.onSubmit();

    expect(store.chatGroups().at(-1)?.userText).toBe('我想延期會議');
    expect(store.chatGroups().at(-1)?.suggestions[0]?.text).toBe('postpone the meeting');
    expect(component.inputControl.value).toBe('');
  });

  it('加入與移除建議時應同步 mock 收藏狀態', () => {
    const group = store.chatGroups()[0];
    const suggestion = group.suggestions.find((item) => !item.existing);

    expect(suggestion).toBeDefined();
    if (!suggestion) return;

    const initialCount = store.items().length;
    component.onToggleSuggestion(group.id, suggestion);

    expect(store.items().length).toBe(initialCount + 1);
    expect(store.chatGroups()[0].suggestions.find((item) => item.id === suggestion.id)?.added).toBe(
      true,
    );

    const addedSuggestion = store
      .chatGroups()[0]
      .suggestions.find((item) => item.id === suggestion.id);
    expect(addedSuggestion).toBeDefined();
    if (!addedSuggestion) return;

    component.onToggleSuggestion(group.id, addedSuggestion);

    expect(store.items().length).toBe(initialCount);
    expect(store.chatGroups()[0].suggestions.find((item) => item.id === suggestion.id)?.added).toBe(
      false,
    );
  });
});
