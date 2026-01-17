import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-auth-header',
  templateUrl: './auth-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmAuthHeaderComponent {
  readonly title = input.required<string>();
  /** 連結前的文字，預設為「或」 */
  readonly prefix = input('或');
}
