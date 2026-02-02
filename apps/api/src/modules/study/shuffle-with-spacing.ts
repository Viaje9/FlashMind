import { StudyCard } from './study.service';

/** 同一張卡片的正反向 StudyCard 在 shuffle 後的最小間隔 */
export const MIN_FORWARD_REVERSE_SPACING = 5;

/**
 * Fisher-Yates shuffle，回傳新陣列不修改原陣列
 */
function fisherYatesShuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 將卡片隨機混合排列，並確保同一張底層卡片的正向與反向至少間隔 minSpacing 張。
 * 若卡片數量不足以滿足間隔要求，則 best-effort 盡量拉開。
 *
 * 策略：
 * 1. 將有配對的卡片拆成「主卡」和「待插入卡」兩組
 * 2. 主卡 + 無配對卡片一起 shuffle 作為基底
 * 3. 將待插入卡逐一插入基底中，選擇離配對最遠的合法位置
 */
export function shuffleWithSpacing(
  cards: readonly StudyCard[],
  minSpacing: number,
): StudyCard[] {
  if (cards.length <= 1) {
    return [...cards];
  }

  // 分組：找出配對卡片
  const seen = new Map<string, StudyCard>();
  const primary: StudyCard[] = [];
  const deferred: { card: StudyCard; pairedWith: string }[] = [];

  for (const card of cards) {
    if (seen.has(card.id)) {
      // 這是配對的第二張（反向卡），延後插入
      deferred.push({ card, pairedWith: card.id });
    } else {
      seen.set(card.id, card);
      primary.push(card);
    }
  }

  // 無配對，直接 shuffle 回傳
  if (deferred.length === 0) {
    return fisherYatesShuffle(cards);
  }

  // Shuffle 基底（主卡 + 無配對卡）
  const base = fisherYatesShuffle(primary);

  // 將 deferred 也 shuffle 以避免固定插入順序
  const shuffledDeferred = fisherYatesShuffle(deferred);

  // 逐一插入 deferred 卡片
  for (const { card, pairedWith } of shuffledDeferred) {
    // 找到配對卡在 base 中的位置
    const partnerIndex = base.findIndex((c) => c.id === pairedWith);

    // 收集所有合法的插入位置（間距 >= minSpacing）
    // 插入位置 i 表示插入在 base[i] 之前（或 base.length 表示末尾）
    const validPositions: number[] = [];
    let bestEffortPos = 0;
    let bestEffortGap = 0;

    for (let i = 0; i <= base.length; i++) {
      // 插入位置 i 時，配對卡的實際位置：
      // - 若 i <= partnerIndex，則 partner 被推到 partnerIndex + 1，插入卡在 i
      // - 若 i > partnerIndex，則 partner 在 partnerIndex，插入卡在 i
      const effectivePartner =
        i <= partnerIndex ? partnerIndex + 1 : partnerIndex;
      const gap = Math.abs(i - effectivePartner);

      if (gap >= minSpacing) {
        validPositions.push(i);
      }

      if (gap > bestEffortGap) {
        bestEffortGap = gap;
        bestEffortPos = i;
      }
    }

    // 從合法位置中隨機選一個；若沒有則用 best-effort
    const insertPos =
      validPositions.length > 0
        ? validPositions[Math.floor(Math.random() * validPositions.length)]
        : bestEffortPos;

    base.splice(insertPos, 0, card);
  }

  return base;
}
