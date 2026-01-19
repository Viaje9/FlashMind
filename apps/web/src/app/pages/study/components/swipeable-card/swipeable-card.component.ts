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
  horizontal: 100, // 左右滑動閾值 (px)
  vertical: 80, // 上滑閾值 (px)
  velocity: 0.5, // 速度閾值 (px/ms)
};

const ROTATION_FACTOR = 15; // 最大旋轉角度
const INDICATOR_THRESHOLD = 30; // 開始顯示指示器的位移

@Component({
  selector: 'fm-swipeable-card',
  templateUrl: './swipeable-card.component.html',
  styleUrl: './swipeable-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmSwipeableCardComponent {
  private readonly cardRef = viewChild<ElementRef<HTMLDivElement>>('cardElement');

  readonly swipeStart = output<void>();
  readonly swipeComplete = output<StudyRating>();

  // 拖拽狀態
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private cardWidth = 0;

  // Signals 用於渲染
  readonly deltaX = signal(0);
  readonly deltaY = signal(0);
  readonly isAnimating = signal(false);
  readonly isFlyingOut = signal(false);

  readonly currentDirection = computed((): SwipeDirection => {
    const dx = this.deltaX();
    const dy = this.deltaY();

    // 上滑優先判斷
    if (dy < -INDICATOR_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      return 'up';
    }
    if (dx > INDICATOR_THRESHOLD) {
      return 'right';
    }
    if (dx < -INDICATOR_THRESHOLD) {
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

  readonly indicatorOpacity = computed(() => {
    const dx = this.deltaX();
    const dy = this.deltaY();
    const direction = this.currentDirection();

    if (direction === 'right') {
      return Math.min((dx - INDICATOR_THRESHOLD) / (SWIPE_THRESHOLD.horizontal - INDICATOR_THRESHOLD), 1);
    }
    if (direction === 'left') {
      return Math.min((Math.abs(dx) - INDICATOR_THRESHOLD) / (SWIPE_THRESHOLD.horizontal - INDICATOR_THRESHOLD), 1);
    }
    if (direction === 'up') {
      return Math.min((Math.abs(dy) - INDICATOR_THRESHOLD) / (SWIPE_THRESHOLD.vertical - INDICATOR_THRESHOLD), 1);
    }
    return 0;
  });

  onPointerDown(event: PointerEvent): void {
    // 忽略按鈕點擊
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }

    const card = this.cardRef()?.nativeElement;
    if (!card) return;

    this.isDragging = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startTime = Date.now();
    this.cardWidth = card.offsetWidth;
    this.isAnimating.set(false);

    card.setPointerCapture(event.pointerId);

    // 發射開始滑動事件
    this.swipeStart.emit();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    // 限制下滑
    const limitedDy = Math.min(dy, 20);

    this.deltaX.set(dx);
    this.deltaY.set(limitedDy);
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging) return;

    const card = this.cardRef()?.nativeElement;
    if (card) {
      card.releasePointerCapture(event.pointerId);
    }

    this.isDragging = false;

    const dx = this.deltaX();
    const dy = this.deltaY();
    const elapsed = Date.now() - this.startTime;
    const velocity = Math.sqrt(dx * dx + dy * dy) / elapsed;

    const direction = this.currentDirection();
    const shouldComplete = this.shouldCompleteSwipe(dx, dy, velocity);

    if (shouldComplete && direction !== 'none') {
      this.flyOut(direction);
    } else {
      this.snapBack();
    }
  }

  onPointerCancel(event: PointerEvent): void {
    if (!this.isDragging) return;

    const card = this.cardRef()?.nativeElement;
    if (card) {
      card.releasePointerCapture(event.pointerId);
    }

    this.isDragging = false;
    this.snapBack();
  }

  private shouldCompleteSwipe(dx: number, dy: number, velocity: number): boolean {
    const direction = this.currentDirection();

    // 速度足夠快也可以完成滑動
    if (velocity > SWIPE_THRESHOLD.velocity) {
      return direction !== 'none';
    }

    // 位移超過閾值
    if (direction === 'left' || direction === 'right') {
      return Math.abs(dx) >= SWIPE_THRESHOLD.horizontal;
    }
    if (direction === 'up') {
      return Math.abs(dy) >= SWIPE_THRESHOLD.vertical;
    }

    return false;
  }

  private flyOut(direction: SwipeDirection): void {
    this.isAnimating.set(true);
    this.isFlyingOut.set(true);

    // 計算飛出目標位置
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

    // 等待動畫完成後發射事件
    setTimeout(() => {
      const rating = this.directionToRating(direction);
      this.swipeComplete.emit(rating);
      this.resetPosition();
    }, 300);
  }

  private snapBack(): void {
    this.isAnimating.set(true);
    this.deltaX.set(0);
    this.deltaY.set(0);

    setTimeout(() => {
      this.isAnimating.set(false);
    }, 300);
  }

  private resetPosition(): void {
    this.isAnimating.set(false);
    this.isFlyingOut.set(false);
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
