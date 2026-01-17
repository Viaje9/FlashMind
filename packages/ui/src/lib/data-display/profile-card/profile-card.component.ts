import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'fm-profile-card',
  imports: [NgOptimizedImage],
  templateUrl: './profile-card.component.html',
  styleUrl: './profile-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmProfileCardComponent {
  readonly name = input('使用者');
  readonly email = input('');
  readonly avatarUrl = input('');
  readonly actionLabel = input('管理帳戶');
  readonly showEditIndicator = input(true);

  readonly actionClick = output<void>();

  readonly altText = computed(() => `${this.name()} 的大頭貼`);
}
