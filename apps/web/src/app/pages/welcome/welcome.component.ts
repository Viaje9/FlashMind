import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FmButtonComponent,
  FmDividerComponent,
  FmSocialLoginRowComponent,
  DialogService,
  FmConfirmDialogComponent,
} from '@flashmind/ui';
import { FmWelcomeHeroComponent } from './components/welcome-hero/welcome-hero.component';

@Component({
  selector: 'app-welcome-page',
  imports: [
    FmWelcomeHeroComponent,
    FmButtonComponent,
    FmDividerComponent,
    FmSocialLoginRowComponent,
    RouterLink
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomeComponent {
  private dialogService = inject(DialogService);

  readonly heroTitle = 'FlashMind';
  readonly heroDescription = '建立、學習、記憶。\n讓知識累積變得前所未有的簡單。';
  readonly heroBadge = '每日學習';

  testDialog() {
    const dialogRef = this.dialogService.open(FmConfirmDialogComponent, {
      data: {
        title: '測試對話框',
        message: '這是一個測試對話框。點擊確認或取消來關閉它。'
      },
      maxWidth: '480px'
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('對話框關閉，結果:', result);
    });
  }
}
