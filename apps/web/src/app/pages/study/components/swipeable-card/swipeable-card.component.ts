import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { StudyRating } from '../../../../components/study/study.domain';

type SwipeDirection = 'none' | 'left' | 'right' | 'up';

const SWIPE_THRESHOLD = {
  horizontal: 80,
  vertical: 60,
};

const ROTATION_FACTOR = 12;

@Component({
  selector: 'fm-swipeable-card',
  templateUrl: './swipeable-card.component.html',
  styleUrl: './swipeable-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmSwipeableCardComponent {
  private readonly cardRef = viewChild<ElementRef<HTMLDivElement>>('cardElement');
  private readonly handleRef = viewChild<ElementRef<HTMLDivElement>>('handleElement');

  readonly swipeComplete = output<StudyRating>();

  // 拖拽狀態
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private cardWidth = 0;

  // Signals 用於渲染
  readonly deltaX = signal(0);
  readonly deltaY = signal(0);
  readonly isActive = signal(false);
  readonly isAnimating = signal(false);
  readonly isFlyingOut = signal(false);

  readonly currentDirection = computed((): SwipeDirection => {
    const dx = this.deltaX();
    const dy = this.deltaY();
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20) {
      return 'none';
    }

    // 上滑優先（Y 軸負方向）
    if (dy < -20 && absDy > absDx * 0.8) {
      return 'up';
    }
    if (dx > 20 && absDx > absDy * 0.5) {
      return 'right';
    }
    if (dx < -20 && absDx > absDy * 0.5) {
      return 'left';
    }
    return 'none';
  });

  readonly cardTransform = computed(() => {
    const dx = this.deltaX();
    const dy = this.deltaY();
    const rotation = (dx / (this.cardWidth || 300)) * ROTATION_FACTOR;
    return `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
  });

  readonly isTriggered = computed(() => {
    const dx = this.deltaX();
    const dy = this.deltaY();
    const direction = this.currentDirection();

    if (direction === 'left' || direction === 'right') {
      return Math.abs(dx) >= SWIPE_THRESHOLD.horizontal;
    }
    if (direction === 'up') {
      return Math.abs(dy) >= SWIPE_THRESHOLD.vertical;
    }
    return false;
  });

  readonly indicatorOpacity = computed(() => {
    const dx = this.deltaX();
    const dy = this.deltaY();
    const direction = this.currentDirection();

    const threshold = 30;
    if (direction === 'right') {
      return Math.min((dx - threshold) / (SWIPE_THRESHOLD.horizontal - threshold), 1);
    }
    if (direction === 'left') {
      return Math.min((Math.abs(dx) - threshold) / (SWIPE_THRESHOLD.horizontal - threshold), 1);
    }
    if (direction === 'up') {
      return Math.min((Math.abs(dy) - threshold) / (SWIPE_THRESHOLD.vertical - threshold), 1);
    }
    return 0;
  });

  // 只有從 handle 開始才能拖動
  onHandlePointerDown(event: PointerEvent): void {
    const card = this.cardRef()?.nativeElement;
    const handle = this.handleRef()?.nativeElement;
    if (!card || !handle) return;

    event.preventDefault();
    event.stopPropagation();

    this.isDragging = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.cardWidth = card.offsetWidth;
    this.isActive.set(true);
    this.isAnimating.set(false);

    handle.setPointerCapture(event.pointerId);
  }

  onHandlePointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    event.preventDefault();

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    // 限制下滑幅度
    const limitedDy = Math.min(dy, 30);

    this.deltaX.set(dx);
    this.deltaY.set(limitedDy);
  }

  onHandlePointerUp(event: PointerEvent): void {
    if (!this.isDragging) return;

    const handle = this.handleRef()?.nativeElement;
    if (handle) {
      handle.releasePointerCapture(event.pointerId);
    }

    this.isDragging = false;

    const direction = this.currentDirection();
    const triggered = this.isTriggered();

    if (triggered && direction !== 'none') {
      this.flyOut(direction);
    } else {
      this.snapBack();
    }
  }

  onHandlePointerCancel(event: PointerEvent): void {
    if (!this.isDragging) return;

    const handle = this.handleRef()?.nativeElement;
    if (handle) {
      handle.releasePointerCapture(event.pointerId);
    }

    this.isDragging = false;
    this.snapBack();
  }

  private flyOut(direction: SwipeDirection): void {
    this.isAnimating.set(true);
    this.isFlyingOut.set(true);

    const flyDistance = window.innerWidth + 100;

    switch (direction) {
      case 'right':
        this.deltaX.set(flyDistance);
        break;
      case 'left':
        this.deltaX.set(-flyDistance);
        break;
      case 'up':
        this.deltaY.set(-window.innerHeight);
        break;
    }

    setTimeout(() => {
      const rating = this.directionToRating(direction);
      this.swipeComplete.emit(rating);
      this.resetPosition();
    }, 250);
  }

  private snapBack(): void {
    this.isAnimating.set(true);
    this.deltaX.set(0);
    this.deltaY.set(0);

    setTimeout(() => {
      this.isAnimating.set(false);
      this.isActive.set(false);
    }, 200);
  }

  private resetPosition(): void {
    this.isAnimating.set(false);
    this.isFlyingOut.set(false);
    this.isActive.set(false);
    this.deltaX.set(0);
    this.deltaY.set(0);
  }

  private directionToRating(direction: SwipeDirection): StudyRating {
    switch (direction) {
      case 'right':
        return 'known';
      case 'left':
        return 'unknown';
      case 'up':
        return 'unfamiliar';
      default:
        return 'unknown';
    }
  }
}
