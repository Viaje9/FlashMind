import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
  ViewChild,
} from '@angular/core';
import { Configuration } from '@flashmind/api-client';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { marked } from 'marked';
import {
  type SpeakingAssistantChatRequest,
  type SpeakingAssistantMessage,
} from '@flashmind/api-client';

const ASSISTANT_PANEL_INITIAL_TOP = 96;
const ASSISTANT_PANEL_HEIGHT = 380;
const ASSISTANT_PANEL_MIN_HEIGHT = 260;
const ASSISTANT_PANEL_SAFE_BOTTOM = 12;
const ASSISTANT_PANEL_TOP_MARGIN = 12;
const ASSISTANT_EFFORT_STORAGE_KEY = 'flashmind.study-assistant-effort';
const ASSISTANT_PANEL_TOP_STORAGE_KEY = 'flashmind.study-assistant-panel-top';
const ASSISTANT_TOGGLE_TOP_STORAGE_KEY = 'flashmind.study-assistant-toggle-top';
const ASSISTANT_EFFORT_VALUES = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

interface StudyAssistantToolCall {
  callId: string;
  name: string;
  arguments?: string;
  result?: unknown;
  expanded: boolean;
}

interface StudyAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: StudyAssistantToolCall[];
  toolCallsExpanded?: boolean;
}

type StudyAssistantEffort = SpeakingAssistantChatRequest.EffortEnum;

interface StudyAssistantEffortOption {
  value: StudyAssistantEffort;
  icon: string;
  label: string;
}

@Component({
  selector: 'fm-study-assistant-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './study-assistant-panel.component.html',
  styleUrl: './study-assistant-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyAssistantPanelComponent {
  @ViewChild('assistantList') private assistantList?: ElementRef<HTMLDivElement>;
  readonly word = input('');
  readonly meanings = input<string[]>([]);

  readonly assistantInputControl = new FormControl('', { nonNullable: true });
  readonly assistantPanelOpen = signal(false);
  readonly assistantMessages = signal<StudyAssistantMessage[]>([]);
  readonly assistantSending = signal(false);
  readonly assistantEffort = signal<StudyAssistantEffort>(this.readStoredEffort());
  readonly assistantPanelTop = signal(
    this.readStoredPosition(ASSISTANT_PANEL_TOP_STORAGE_KEY, ASSISTANT_PANEL_INITIAL_TOP) ??
      ASSISTANT_PANEL_INITIAL_TOP,
  );
  readonly assistantPanelHeight = signal(ASSISTANT_PANEL_HEIGHT);
  readonly assistantToggleTop = signal<number | null>(
    this.readStoredPosition(ASSISTANT_TOGGLE_TOP_STORAGE_KEY, null),
  );
  readonly assistantEffortOptions: ReadonlyArray<StudyAssistantEffortOption> = [
    { value: 'none', icon: 'do_not_disturb_on', label: '不使用推理' },
    { value: 'low', icon: 'signal_cellular_1_bar', label: '低推理' },
    { value: 'medium', icon: 'signal_cellular_2_bar', label: '中推理' },
    { value: 'high', icon: 'signal_cellular_3_bar', label: '高推理' },
    { value: 'xhigh', icon: 'signal_cellular_4_bar', label: '超高推理' },
    { value: 'max', icon: 'rocket_launch', label: '最大推理' },
  ];
  readonly selectedAssistantEffort = computed(
    () =>
      this.assistantEffortOptions.find((option) => option.value === this.assistantEffort()) ??
      this.assistantEffortOptions[0],
  );

  private readonly apiConfiguration = inject(Configuration);
  private assistantRequestId = 0;
  private safeAreaInsetTop = 0;
  private safeAreaInsetMeasured = false;
  private assistantDragState = { active: false, pointerId: -1, offsetY: 0 };
  private assistantResizeState = {
    active: false,
    pointerId: -1,
    startHeight: ASSISTANT_PANEL_HEIGHT,
    startClientY: 0,
  };
  private assistantToggleDragState = {
    active: false,
    moved: false,
    pointerId: -1,
    offsetY: 0,
    startClientY: 0,
    suppressClick: false,
  };

  toggleAssistant(): void {
    if (this.assistantToggleDragState.suppressClick) {
      this.assistantToggleDragState.suppressClick = false;
      return;
    }

    this.assistantPanelOpen.update((open) => !open);
    this.clampAssistantPanelBounds();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.safeAreaInsetMeasured = false;
    this.clampAssistantPanelBounds();
  }

  onTogglePointerDown(event: PointerEvent): void {
    const button = event.currentTarget as HTMLElement | null;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    this.assistantToggleTop.set(rect.top);
    this.assistantToggleDragState = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
      startClientY: event.clientY,
      suppressClick: false,
    };
    button.setPointerCapture(event.pointerId);
  }

  onTogglePointerMove(event: PointerEvent): void {
    const state = this.assistantToggleDragState;
    if (!state.active || state.pointerId !== event.pointerId) return;

    if (Math.abs(event.clientY - state.startClientY) > 4) {
      state.moved = true;
    }
    if (!state.moved) return;

    event.preventDefault();
    const button = event.currentTarget as HTMLElement | null;
    const height = button?.getBoundingClientRect().height ?? 44;
    const maxTop = Math.max(12, window.innerHeight - height - 12);
    this.assistantToggleTop.set(Math.min(Math.max(event.clientY - state.offsetY, 12), maxTop));
  }

  onTogglePointerEnd(event: PointerEvent): void {
    const state = this.assistantToggleDragState;
    if (!state.active || state.pointerId !== event.pointerId) return;

    const button = event.currentTarget as HTMLElement | null;
    if (state.moved) {
      state.suppressClick = true;
      setTimeout(() => {
        this.assistantToggleDragState.suppressClick = false;
      });
    }
    this.assistantToggleDragState.active = false;
    this.assistantToggleDragState.pointerId = -1;
    if (state.moved) {
      this.persistPosition(ASSISTANT_TOGGLE_TOP_STORAGE_KEY, this.assistantToggleTop());
    }
    if (button?.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing || (!event.metaKey && !event.ctrlKey)) return;

    event.preventDefault();
    void this.sendMessage();
  }

  cycleEffort(): void {
    const currentIndex = this.assistantEffortOptions.findIndex(
      (option) => option.value === this.assistantEffort(),
    );
    const nextIndex = (currentIndex + 1) % this.assistantEffortOptions.length;
    this.setAssistantEffort(this.assistantEffortOptions[nextIndex].value);
  }

  getToolLabel(name: string): string {
    const labels: Record<string, string> = {
      search_user_vocabulary: '搜尋單字卡',
      get_word_proficiency: '查詢熟練度',
    };
    return labels[name] ?? name;
  }

  getToolSummary(toolCall: StudyAssistantToolCall): string {
    const query = this.readToolQuery(toolCall.arguments);
    return query
      ? `${this.getToolLabel(toolCall.name)}：${query}`
      : this.getToolLabel(toolCall.name);
  }

  toggleAllToolCalls(messageId: string): void {
    this.assistantMessages.update((messages) =>
      messages.map((message) =>
        message.id !== messageId
          ? message
          : { ...message, toolCallsExpanded: message.toolCallsExpanded === false },
      ),
    );
  }

  toggleToolCall(messageId: string, callId: string): void {
    this.assistantMessages.update((messages) =>
      messages.map((message) =>
        message.id !== messageId
          ? message
          : {
              ...message,
              toolCalls: message.toolCalls?.map((toolCall) =>
                toolCall.callId === callId
                  ? { ...toolCall, expanded: !toolCall.expanded }
                  : toolCall,
              ),
            },
      ),
    );
  }

  formatToolArguments(argumentsText?: string): string {
    return this.formatToolValue(argumentsText);
  }

  formatToolResult(result: unknown): string {
    return this.formatToolValue(result);
  }

  async sendMessage(): Promise<void> {
    const content = this.assistantInputControl.value.trim();
    if (!content || this.assistantSending()) return;

    const userMessage: StudyAssistantMessage = {
      id: this.createMessageId(),
      role: 'user',
      content,
    };
    const previousMessages = this.assistantMessages();
    const requestId = ++this.assistantRequestId;
    const assistantMessageId = this.createMessageId();
    this.assistantMessages.set([
      ...previousMessages,
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        toolCallsExpanded: true,
      },
    ]);
    this.scrollAssistantListToBottom();
    this.assistantInputControl.setValue('');
    this.assistantSending.set(true);

    try {
      const history = previousMessages.map<SpeakingAssistantMessage>((message) => ({
        role: message.role,
        content: message.content,
      }));
      await this.readAssistantStream(
        {
          message: this.buildAssistantPrompt(content),
          history,
          effort: this.assistantEffort(),
        },
        requestId,
        assistantMessageId,
      );
    } catch {
      if (requestId === this.assistantRequestId) {
        this.assistantMessages.update((messages) => [
          ...messages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: '抱歉，回覆失敗，請稍後再試。' }
              : message,
          ),
        ]);
      }
    } finally {
      if (requestId === this.assistantRequestId) this.assistantSending.set(false);
    }
  }

  private async readAssistantStream(
    request: {
      message: string;
      history: SpeakingAssistantMessage[];
      effort: StudyAssistantEffort;
    },
    requestId: number,
    assistantMessageId: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.apiConfiguration.basePath ?? '/api'}/speaking/assistant/chat/stream`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok || !response.body) {
      throw new Error('Assistant stream failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedResult = false;

    const consumeEvent = (eventText: string) => {
      const event = this.parseSseEvent(eventText);
      if (!event) return;

      if (event.event === 'assistant_delta') {
        this.patchAssistantMessage(requestId, assistantMessageId, (message) => ({
          ...message,
          content: message.content + String(event.data['delta'] ?? ''),
        }));
      } else if (event.event === 'tool_call') {
        const callId = String(event.data['callId'] ?? '');
        if (!callId) return;
        this.patchAssistantMessage(requestId, assistantMessageId, (message) => ({
          ...message,
          toolCalls: [
            ...(message.toolCalls ?? []),
            {
              callId,
              name: String(event.data['name'] ?? ''),
              arguments: String(event.data['arguments'] ?? '{}'),
              expanded: false,
            },
          ],
          toolCallsExpanded: true,
        }));
      } else if (event.event === 'tool_result') {
        const callId = String(event.data['callId'] ?? '');
        this.patchAssistantMessage(requestId, assistantMessageId, (message) => ({
          ...message,
          toolCalls: message.toolCalls?.map((toolCall) =>
            toolCall.callId === callId ? { ...toolCall, result: event.data['result'] } : toolCall,
          ),
        }));
      } else if (event.event === 'result') {
        receivedResult = true;
        const result = event.data['data'] as
          | {
              reply?: string;
              toolCalls?: Array<{
                name: string;
                callId?: string;
                arguments?: string;
                result?: unknown;
              }>;
            }
          | undefined;
        if (result?.reply) {
          this.patchAssistantMessage(requestId, assistantMessageId, (message) => ({
            ...message,
            content: result.reply ?? message.content,
          }));
        }
      } else if (event.event === 'error') {
        throw new Error(String(event.data['message'] ?? 'Assistant stream failed'));
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const eventText of events) consumeEvent(eventText);
      if (done) break;
    }

    if (buffer.trim()) consumeEvent(buffer);
    if (!receivedResult) throw new Error('Assistant stream ended without result');
  }

  private patchAssistantMessage(
    requestId: number,
    assistantMessageId: string,
    patch: (message: StudyAssistantMessage) => StudyAssistantMessage,
  ): void {
    if (requestId !== this.assistantRequestId) return;
    this.assistantMessages.update((messages) =>
      messages.map((message) => (message.id === assistantMessageId ? patch(message) : message)),
    );
    this.scrollAssistantListToBottom();
  }

  private scrollAssistantListToBottom(): void {
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      const list = this.assistantList?.nativeElement;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  private parseSseEvent(
    eventText: string,
  ): { event: string; data: Record<string, unknown> } | null {
    const event = eventText
      .split('\n')
      .find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim();
    const data = eventText
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');

    if (!event || !data) return null;
    return { event, data: JSON.parse(data) as Record<string, unknown> };
  }

  private formatToolValue(value: unknown): string {
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }

    try {
      return JSON.stringify(value, null, 2) ?? '';
    } catch {
      return String(value ?? '');
    }
  }

  private readToolQuery(argumentsText?: string): string {
    if (!argumentsText) return '';

    try {
      const parsed = JSON.parse(argumentsText) as unknown;
      if (!parsed || typeof parsed !== 'object') return '';
      const values = parsed as Record<string, unknown>;
      const query = values['query'] ?? values['word'];
      return typeof query === 'string' ? query.trim() : '';
    } catch {
      return '';
    }
  }

  private readStoredEffort(): StudyAssistantEffort {
    if (typeof localStorage === 'undefined') return 'none';

    try {
      const stored = localStorage.getItem(ASSISTANT_EFFORT_STORAGE_KEY);
      return ASSISTANT_EFFORT_VALUES.includes(stored as StudyAssistantEffort)
        ? (stored as StudyAssistantEffort)
        : 'none';
    } catch {
      return 'none';
    }
  }

  private readStoredPosition(key: string, fallback: number | null): number | null {
    if (typeof localStorage === 'undefined') return fallback;

    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return fallback;
      const value = Number(stored);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  private persistPosition(key: string, value: number | null): void {
    if (value === null) return;

    try {
      localStorage.setItem(key, String(value));
    } catch {
      // 儲存空間不可用時仍保留本次頁面狀態。
    }
  }

  private setAssistantEffort(effort: StudyAssistantEffort): void {
    this.assistantEffort.set(effort);

    try {
      localStorage.setItem(ASSISTANT_EFFORT_STORAGE_KEY, effort);
    } catch {
      // 儲存空間不可用時仍保留本次頁面狀態。
    }
  }

  clearChat(): void {
    this.assistantRequestId++;
    this.assistantMessages.set([]);
    this.assistantSending.set(false);
  }

  onPanelPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest('[data-study-assistant-drag-handle="true"]') ||
      target.closest('button,textarea,input,select,a,[role="button"]')
    ) {
      return;
    }

    const panel = event.currentTarget as HTMLElement | null;
    if (!panel) return;

    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    this.assistantDragState = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
    };
    panel.setPointerCapture(event.pointerId);
  }

  onPanelPointerMove(event: PointerEvent): void {
    if (!this.assistantDragState.active || this.assistantDragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const minTop = this.getAssistantPanelTopMargin();
    const maxTop = Math.max(
      minTop,
      window.innerHeight - this.assistantPanelHeight() - ASSISTANT_PANEL_SAFE_BOTTOM,
    );
    const nextTop = event.clientY - this.assistantDragState.offsetY;
    this.assistantPanelTop.set(Math.min(Math.max(nextTop, minTop), maxTop));
  }

  onPanelPointerEnd(event: PointerEvent): void {
    if (this.assistantDragState.pointerId !== event.pointerId) return;

    this.assistantDragState = { active: false, pointerId: -1, offsetY: 0 };
    this.persistPosition(ASSISTANT_PANEL_TOP_STORAGE_KEY, this.assistantPanelTop());
    const panel = event.currentTarget as HTMLElement | null;
    if (panel?.hasPointerCapture(event.pointerId)) panel.releasePointerCapture(event.pointerId);
  }

  onResizePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement | null;
    this.assistantResizeState = {
      active: true,
      pointerId: event.pointerId,
      startHeight: this.assistantPanelHeight(),
      startClientY: event.clientY,
    };
    handle?.setPointerCapture(event.pointerId);
  }

  onResizePointerMove(event: PointerEvent): void {
    const state = this.assistantResizeState;
    if (!state.active || state.pointerId !== event.pointerId) return;

    event.preventDefault();
    const maxHeight = Math.max(
      ASSISTANT_PANEL_MIN_HEIGHT,
      window.innerHeight - this.assistantPanelTop() - ASSISTANT_PANEL_SAFE_BOTTOM,
    );
    const nextHeight = state.startHeight + event.clientY - state.startClientY;
    this.assistantPanelHeight.set(
      Math.min(Math.max(nextHeight, ASSISTANT_PANEL_MIN_HEIGHT), maxHeight),
    );
  }

  onResizePointerEnd(event: PointerEvent): void {
    if (this.assistantResizeState.pointerId !== event.pointerId) return;

    this.assistantResizeState = {
      active: false,
      pointerId: -1,
      startHeight: this.assistantPanelHeight(),
      startClientY: 0,
    };
    const handle = event.currentTarget as HTMLElement | null;
    if (handle?.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }

  renderMarkdown(content: string): string {
    const rendered = marked.parse(this.escapeHtml(content), {
      async: false,
      breaks: true,
      gfm: true,
    });

    return rendered.replace(
      /<table>([\s\S]*?)<\/table>/g,
      (_match, tableContent: string) =>
        `<div class="study-assistant-markdown-table-wrap"><table>${tableContent}</table></div>`,
    );
  }

  private buildAssistantPrompt(content: string): string {
    const meanings = this.meanings().join('；');
    const context = meanings
      ? `目前正在學習的單字是「${this.word()}」，中文意思是「${meanings}」。`
      : `目前正在學習的單字是「${this.word()}」。`;
    return `${context}\n請以這張卡片為上下文回答：${content}`;
  }

  private escapeHtml(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private clampAssistantPanelBounds(): void {
    if (typeof window === 'undefined') return;

    const minTop = this.getAssistantPanelTopMargin();
    const maxTop = Math.max(
      minTop,
      window.innerHeight - this.assistantPanelHeight() - ASSISTANT_PANEL_SAFE_BOTTOM,
    );
    const clampedTop = Math.min(Math.max(this.assistantPanelTop(), minTop), maxTop);
    this.assistantPanelTop.set(clampedTop);

    const maxHeight = Math.max(
      ASSISTANT_PANEL_MIN_HEIGHT,
      window.innerHeight - clampedTop - ASSISTANT_PANEL_SAFE_BOTTOM,
    );
    this.assistantPanelHeight.set(
      Math.min(Math.max(this.assistantPanelHeight(), ASSISTANT_PANEL_MIN_HEIGHT), maxHeight),
    );
    this.persistPosition(ASSISTANT_PANEL_TOP_STORAGE_KEY, clampedTop);
  }

  private getAssistantPanelTopMargin(): number {
    return Math.max(
      ASSISTANT_PANEL_TOP_MARGIN,
      Math.ceil(this.getSafeAreaInsetTop() + ASSISTANT_PANEL_TOP_MARGIN),
    );
  }

  private getSafeAreaInsetTop(): number {
    if (this.safeAreaInsetMeasured) return this.safeAreaInsetTop;
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

    const host = document.body ?? document.documentElement;
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);';
    host.appendChild(probe);
    const parsed = Number.parseFloat(window.getComputedStyle(probe).paddingTop);
    host.removeChild(probe);

    this.safeAreaInsetTop = Number.isFinite(parsed) ? parsed : 0;
    this.safeAreaInsetMeasured = true;
    return this.safeAreaInsetTop;
  }

  private createMessageId(): string {
    return `study-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
