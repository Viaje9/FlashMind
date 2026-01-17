import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  FmAlertComponent,
  FmAuthPageLayoutComponent,
  FmButtonComponent,
  FmDividerComponent,
  FmSocialLoginRowComponent,
} from '@flashmind/ui';
import { FmWelcomeHeroComponent } from './components/welcome-hero/welcome-hero.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-welcome-page',
  imports: [
    RouterLink,
    FmAlertComponent,
    FmAuthPageLayoutComponent,
    FmButtonComponent,
    FmDividerComponent,
    FmSocialLoginRowComponent,
    FmWelcomeHeroComponent,
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly heroTitle = 'FlashMind';
  readonly heroDescription = '建立、學習、記憶。\n讓知識累積變得前所未有的簡單。';
  readonly heroBadge = '每日學習';

  errorMessage = signal<string | null>(null);

  ngOnInit() {
    const error = this.route.snapshot.queryParamMap.get('error');
    if (error) {
      this.errorMessage.set(this.getErrorMessage(error));
    }
  }

  loginWithGoogle() {
    this.authService.loginWithGoogle();
  }

  private getErrorMessage(error: string): string {
    switch (error) {
      case 'access_denied':
        return '授權失敗：您已取消 Google 登入授權';
      default:
        return `登入失敗：${error}`;
    }
  }
}
