import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-auth-page-layout',
  templateUrl: './auth-page-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmAuthPageLayoutComponent {
  /** 主內容區域的垂直對齊方式 */
  readonly mainAlign = input<'center' | 'start'>('center');
}
