import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-target-vocabulary-selection-check',
  template: `
    <label class="selection-check" [class.is-disabled]="disabled()">
      <input
        type="checkbox"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel()"
        [attr.data-testid]="testId()"
        (change)="changed.emit()"
      />
      <span class="selection-mark" aria-hidden="true">
        @if (indeterminate()) {
          <span class="material-symbols-outlined">remove</span>
        } @else if (checked()) {
          <span class="material-symbols-outlined">check</span>
        }
      </span>
      <span class="selection-label"><ng-content /></span>
    </label>
  `,
  styles: `
    :host {
      display: inline-flex;
      position: relative;
      flex: none;
    }
    .selection-check {
      display: inline-flex;
      min-height: 2.75rem;
      cursor: pointer;
      align-items: center;
      gap: 0.55rem;
      color: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    input {
      position: absolute;
      z-index: 1;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      cursor: inherit;
      opacity: 0;
    }
    .selection-mark {
      display: grid;
      width: 1.75rem;
      height: 1.75rem;
      flex: none;
      place-items: center;
      border: 1px solid rgb(125 211 252 / 0.42);
      border-radius: 0.65rem;
      background: rgb(14 165 233 / 0.08);
      color: transparent;
      box-shadow: inset 0 1px rgb(255 255 255 / 0.05);
      transition:
        transform 150ms ease,
        border-color 150ms ease,
        background 150ms ease,
        box-shadow 150ms ease;
    }
    .selection-mark,
    .selection-label {
      pointer-events: none;
    }
    input:checked + .selection-mark,
    input:indeterminate + .selection-mark {
      border-color: #38bdf8;
      background: #0284c7;
      color: white;
      box-shadow:
        0 5px 14px rgb(2 132 199 / 0.28),
        inset 0 1px rgb(255 255 255 / 0.32);
      transform: translateY(-1px);
    }
    input:focus-visible + .selection-mark {
      outline: 3px solid rgb(56 189 248 / 0.3);
      outline-offset: 3px;
    }
    .selection-check:hover .selection-mark {
      border-color: rgb(56 189 248 / 0.8);
    }
    .material-symbols-outlined {
      font-size: 1rem;
      font-weight: 700;
    }
    .selection-label:empty {
      display: none;
    }
    .is-disabled {
      cursor: wait;
      opacity: 0.5;
    }
    @media (prefers-color-scheme: light) {
      .selection-mark {
        border-color: #bae6fd;
        background: #f0f9ff;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .selection-mark {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionCheckComponent {
  readonly checked = input(false);
  readonly indeterminate = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input<string>();
  readonly testId = input<string>();
  readonly changed = output<void>();
}
