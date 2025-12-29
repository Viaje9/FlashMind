import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FmButtonComponent,
  FmDividerComponent,
  FmSocialLoginRowComponent,
  FmWelcomeHeroComponent
} from '../../../../../../packages/ui/src/index';

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
  readonly heroTitle = 'FlashMind';
  readonly heroDescription = '建立、學習、記憶。\n讓知識累積變得前所未有的簡單。';
  readonly heroBadge = '每日學習';
}
