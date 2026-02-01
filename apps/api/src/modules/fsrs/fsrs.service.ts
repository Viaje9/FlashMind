import { Injectable } from '@nestjs/common';
import {
  createEmptyCard,
  fsrs,
  FSRS,
  Rating,
  Card as FsrsCard,
  RecordLogItem,
  State,
  Grade,
  type Steps,
} from 'ts-fsrs';
import { createHash } from 'crypto';

/**
 * 應用程式使用的評分類型
 * - known: 知道（右滑）
 * - unfamiliar: 不熟（上滑）
 * - unknown: 不知道（左滑）
 */
export type StudyRating = 'known' | 'unfamiliar' | 'unknown';

/**
 * 每牌組的 FSRS 參數
 */
export interface DeckFsrsParams {
  requestRetention?: number;
  maximumInterval?: number;
  learningSteps?: Steps;
  relearningSteps?: Steps;
}

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
  learningStep: number;
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
  private readonly defaultScheduler: FSRS = fsrs();
  private readonly schedulerCache = new Map<string, FSRS>();

  /**
   * 根據參數取得或建立 FSRS 排程器
   * 使用參數 hash 作為快取 key
   */
  getScheduler(params?: DeckFsrsParams): FSRS {
    if (!params) {
      return this.defaultScheduler;
    }

    const key = this.computeParamsHash(params);
    const cached = this.schedulerCache.get(key);
    if (cached) {
      return cached;
    }

    const scheduler = fsrs({
      request_retention: params.requestRetention,
      maximum_interval: params.maximumInterval,
      learning_steps: params.learningSteps,
      relearning_steps: params.relearningSteps,
    });
    this.schedulerCache.set(key, scheduler);
    return scheduler;
  }

  /**
   * 計算參數的 hash 值作為快取 key
   */
  private computeParamsHash(params: DeckFsrsParams): string {
    const payload = JSON.stringify({
      requestRetention: params.requestRetention,
      maximumInterval: params.maximumInterval,
      learningSteps: params.learningSteps,
      relearningSteps: params.relearningSteps,
    });
    return createHash('md5').update(payload).digest('hex');
  }

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
      learningStep: 0,
    };
  }

  /**
   * 計算下次複習日期
   * @param currentState 卡片目前的排程狀態
   * @param rating 使用者評分
   * @param now 評分時間
   * @param fsrsParams 可選的牌組 FSRS 參數
   * @returns 更新後的排程狀態和記錄
   */
  calculateNextReview(
    currentState: CardScheduleState,
    rating: StudyRating,
    now: Date = new Date(),
    fsrsParams?: DeckFsrsParams,
  ): ReviewResult {
    // 將應用程式狀態轉換為 FSRS Card
    const fsrsCard: FsrsCard = {
      due: currentState.due ?? now,
      stability: currentState.stability ?? 0,
      difficulty: currentState.difficulty ?? 0,
      elapsed_days: currentState.elapsedDays,
      scheduled_days: currentState.scheduledDays,
      learning_steps: currentState.learningStep,
      reps: currentState.reps,
      lapses: currentState.lapses,
      state: this.mapStateToFsrs(currentState.state),
      last_review: currentState.lastReview ?? undefined,
    };

    // 取得排程器
    const scheduler = this.getScheduler(fsrsParams);

    // 計算排程
    const fsrsRating = this.mapRatingToFsrs(rating);
    const result: RecordLogItem = scheduler.next(fsrsCard, now, fsrsRating);

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
        learningStep: result.card.learning_steps,
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
   * 將逗號分隔的步驟字串轉換為陣列
   * @param stepsString 逗號分隔的步驟字串，例如 "1m,10m"
   * @returns 步驟陣列，例如 ["1m", "10m"]
   */
  parseLearningSteps(stepsString: string): Steps {
    return stepsString
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) as unknown as Steps;
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
