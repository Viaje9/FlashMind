import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'fm-welcome-hero',
  imports: [NgOptimizedImage],
  templateUrl: './welcome-hero.component.html',
  styleUrl: './welcome-hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmWelcomeHeroComponent {
  readonly title = input('FlashMind');
  readonly description = input('建立、學習、記憶。\n讓知識累積變得前所未有的簡單。');
  readonly badgeText = input('每日學習');
  readonly imageUrl = input('');

  readonly descriptionLines = computed(() =>
    this.description()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );
}
