import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopicConversationComposerComponent } from './topic-conversation-composer.component';

describe('TopicConversationComposerComponent', () => {
  let fixture: ComponentFixture<TopicConversationComposerComponent>;
  let component: TopicConversationComposerComponent;
  let textarea: HTMLTextAreaElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopicConversationComposerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TopicConversationComposerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    textarea = fixture.nativeElement.querySelector('textarea');
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('中文輸入法組字期間不應提前同步或打斷組字文字', () => {
    textarea.dispatchEvent(new Event('compositionstart', { bubbles: true }));

    textarea.value = 'ㄅ';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.formModel().message).toBe('');
    expect(textarea.value).toBe('ㄅ');

    textarea.dispatchEvent(new Event('compositionend', { bubbles: true }));
    fixture.detectChanges();

    expect(component.formModel().message).toBe('ㄅ');
  });
});
