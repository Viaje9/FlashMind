import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
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
export class WelcomeComponent {
  private authService = inject(AuthService);

  readonly heroTitle = 'FlashMind';
  readonly heroDescription = '建立、學習、記憶。\n讓知識累積變得前所未有的簡單。';
  readonly heroBadge = '每日學習';

  loginWithGoogle() {
    this.authService.loginWithGoogle();
  }
}
