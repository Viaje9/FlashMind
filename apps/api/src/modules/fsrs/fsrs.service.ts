import { Injectable } from '@nestjs/common';
import {
  createEmptyCard,
  fsrs,
  Rating,
  Card as FsrsCard,
  RecordLogItem,
  State,
  Grade,
} from 'ts-fsrs';

/**
 * 應用程式使用的評分類型
 * - known: 知道（右滑）
 * - unfamiliar: 不熟（上滑）
 * - unknown: 不知道（左滑）
 */
export type StudyRating = 'known' | 'unfamiliar' | 'unknown';

/**
 * 卡片排程狀態
 */
export interface CardScheduleState {
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
  due: Date | null;
  stability: number | null;
  difficulty: number | null;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

/**
 * 評分結果
 */
export interface ReviewResult {
  card: CardScheduleState;
  log: {
    rating: StudyRating;
    state: string;
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    review: Date;
  };
}

@Injectable()
export class FsrsService {
  private readonly scheduler = fsrs();

  /**
   * 將 StudyRating 對應到 FSRS Grade
   */
  mapRatingToFsrs(rating: StudyRating): Grade {
    switch (rating) {
      case 'known':
        return Rating.Good as Grade;
      case 'unfamiliar':
        return Rating.Hard as Grade;
      case 'unknown':
        return Rating.Again as Grade;
    }
  }

  /**
   * 將 FSRS State 對應到應用程式狀態
   */
  private mapStateToApp(state: State): CardScheduleState['state'] {
    switch (state) {
      case State.New:
        return 'NEW';
      case State.Learning:
        return 'LEARNING';
      case State.Review:
        return 'REVIEW';
      case State.Relearning:
        return 'RELEARNING';
    }
  }

  /**
   * 將應用程式狀態對應到 FSRS State
   */
  private mapStateToFsrs(state: CardScheduleState['state']): State {
    switch (state) {
      case 'NEW':
        return State.New;
      case 'LEARNING':
        return State.Learning;
      case 'REVIEW':
        return State.Review;
      case 'RELEARNING':
        return State.Relearning;
    }
  }

  /**
   * 初始化新卡片的 FSRS 狀態
   */
  initializeCard(): CardScheduleState {
    const card = createEmptyCard();
    return {
      state: this.mapStateToApp(card.state),
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsed_days,
      scheduledDays: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      lastReview: card.last_review ?? null,
    };
  }

  /**
   * 計算下次複習日期
   * @param currentState 卡片目前的排程狀態
   * @param rating 使用者評分
   * @param now 評分時間
   * @returns 更新後的排程狀態和記錄
   */
  calculateNextReview(
    currentState: CardScheduleState,
    rating: StudyRating,
    now: Date = new Date(),
  ): ReviewResult {
    // 將應用程式狀態轉換為 FSRS Card
    const fsrsCard: FsrsCard = {
      due: currentState.due ?? now,
      stability: currentState.stability ?? 0,
      difficulty: currentState.difficulty ?? 0,
      elapsed_days: currentState.elapsedDays,
      scheduled_days: currentState.scheduledDays,
      learning_steps: 0,
      reps: currentState.reps,
      lapses: currentState.lapses,
      state: this.mapStateToFsrs(currentState.state),
      last_review: currentState.lastReview ?? undefined,
    };

    // 計算排程
    const fsrsRating = this.mapRatingToFsrs(rating);
    const result: RecordLogItem = this.scheduler.next(fsrsCard, now, fsrsRating);

    // 轉換結果
    return {
      card: {
        state: this.mapStateToApp(result.card.state),
        due: result.card.due,
        stability: result.card.stability,
        difficulty: result.card.difficulty,
        elapsedDays: result.card.elapsed_days,
        scheduledDays: result.card.scheduled_days,
        reps: result.card.reps,
        lapses: result.card.lapses,
        lastReview: result.card.last_review ?? null,
      },
      log: {
        rating,
        state: this.mapStateToApp(result.log.state),
        due: result.log.due,
        stability: result.log.stability,
        difficulty: result.log.difficulty,
        elapsedDays: result.log.elapsed_days,
        scheduledDays: result.log.scheduled_days,
        review: result.log.review,
      },
    };
  }

  /**
   * 檢查卡片是否到期需要複習
   */
  isDue(state: CardScheduleState, now: Date = new Date()): boolean {
    if (state.state === 'NEW') {
      return false; // 新卡片不算「到期」
    }
    if (!state.due) {
      return false;
    }
    return state.due <= now;
  }

  /**
   * 檢查卡片是否為新卡
   */
  isNew(state: CardScheduleState): boolean {
    return state.state === 'NEW';
  }
}
