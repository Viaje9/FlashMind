import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { selectionMagnifierView, type SelectionRect } from './speaking-selection.domain';

@Component({
  selector: 'app-speaking-selection-magnifier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', 'data-speaking-selection-overlay': 'true' },
  template: `
    <div
      class="lens"
      data-testid="speaking-selection-magnifier"
      [style.left.px]="left()"
      [style.top.px]="top()"
      [style.background-color]="sourceBackground()"
    >
      <div
        class="line-window"
        [style.top.px]="view().lineTop"
        [style.height.px]="view().lineHeight"
      >
        <div
          class="surface"
          [style.width.px]="sourceWidth()"
          [style.transform]="
            'translate3d(' + view().offsetX + 'px,' + view().offsetY + 'px,0) scale(1.5)'
          "
        >
          <div #content></div>
          @for (rect of highlights(); track $index) {
            <div
              class="highlight"
              [style.left.px]="rect.left"
              [style.top.px]="rect.top"
              [style.width.px]="rect.width"
              [style.height.px]="rect.height"
            ></div>
          }
        </div>
      </div>
      <div class="caret" [style.left.px]="view().caretX"></div>
    </div>
  `,
  styles: `
    :host {
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .lens {
      position: fixed;
      z-index: 80;
      width: 184px;
      height: 60px;
      overflow: hidden;
      border-radius: 30px;
      border: 2px solid rgb(148 163 184 / 0.5);
      background: #122326;
      box-shadow: 0 5px 20px rgb(0 0 0 / 0.24);
      contain: strict;
    }
    .surface {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    .line-window {
      position: absolute;
      left: 0;
      right: 0;
      overflow: hidden;
    }
    .caret {
      position: absolute;
      top: 13px;
      height: 34px;
      width: 2px;
      background: #0ea5e9;
    }
    .highlight {
      position: absolute;
      background: rgb(14 165 233 / 0.25);
    }
    @media (prefers-color-scheme: light) {
      .lens {
        background: #f8fafc;
      }
    }
  `,
})
export class SpeakingSelectionMagnifierComponent {
  readonly source = input.required<HTMLElement>();
  readonly sourceWidth = input.required<number>();
  readonly point = input.required<{ x: number; y: number }>();
  readonly textHeight = input.required<number>();
  readonly view = computed(() =>
    selectionMagnifierView(this.sourceWidth(), this.point(), this.textHeight()),
  );
  readonly sourceBackground = signal<string | null>(null);
  readonly left = input.required<number>();
  readonly top = input.required<number>();
  readonly highlights = input<readonly SelectionRect[]>([]);
  private readonly content = viewChild.required<ElementRef<HTMLDivElement>>('content');

  // 每次抓住拖桿只複製一次。之後只移動畫面，不修改原文或重建複本。
  private readonly copySource = afterRenderEffect(() => {
    const source = this.source();
    const width = this.sourceWidth();
    const clone = source.cloneNode(true) as HTMLElement;
    for (const element of [clone, ...clone.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (
          attribute.name.startsWith('data-speaking-') ||
          ['id', 'data-testid', 'tabindex'].includes(attribute.name)
        )
          element.removeAttribute(attribute.name);
      }
    }
    clone.inert = true;
    const style = getComputedStyle(source);
    const backgroundColor = style.backgroundColor.trim().toLowerCase();
    this.sourceBackground.set(
      isTranslucentBackground(backgroundColor) ? null : style.backgroundColor,
    );
    Object.assign(clone.style, {
      width: `${width}px`,
      maxWidth: 'none',
      margin: '0',
      boxSizing: 'border-box',
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      color: style.color,
      borderRadius: '0',
      boxShadow: 'none',
    });
    this.content().nativeElement.replaceChildren(clone);
  });
}

function isTranslucentBackground(color: string): boolean {
  return (
    !color ||
    color === 'transparent' ||
    color.startsWith('rgba(') ||
    color.startsWith('hsla(') ||
    color.includes(' / ')
  );
}
