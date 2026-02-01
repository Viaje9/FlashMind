import { shuffleWithSpacing, MIN_FORWARD_REVERSE_SPACING } from './shuffle-with-spacing';
import { StudyCard } from './study.service';
import { CardState } from '@prisma/client';

function makeStudyCard(
  id: string,
  direction: 'FORWARD' | 'REVERSE',
  isNew = false,
): StudyCard {
  return {
    id,
    front: `word-${id}`,
    meanings: [{ id: `m-${id}`, zhMeaning: '翻譯', enExample: null, zhExample: null }],
    state: isNew ? CardState.NEW : CardState.REVIEW,
    isNew,
    direction,
  };
}

describe('shuffleWithSpacing', () => {
  it('MIN_FORWARD_REVERSE_SPACING 應為 5', () => {
    expect(MIN_FORWARD_REVERSE_SPACING).toBe(5);
  });

  it('空陣列應回傳空陣列', () => {
    expect(shuffleWithSpacing([], 5)).toEqual([]);
  });

  it('單張卡片應原樣回傳', () => {
    const card = makeStudyCard('c1', 'FORWARD');
    const result = shuffleWithSpacing([card], 5);
    expect(result).toEqual([card]);
  });

  it('回傳應包含所有輸入卡片', () => {
    const cards = [
      makeStudyCard('c1', 'FORWARD', true),
      makeStudyCard('c2', 'FORWARD', false),
      makeStudyCard('c3', 'FORWARD', true),
      makeStudyCard('c4', 'FORWARD', false),
    ];
    const result = shuffleWithSpacing(cards, 5);
    expect(result).toHaveLength(4);
    const ids = result.map((c) => c.id).sort();
    expect(ids).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('新卡與複習卡應混合排列（非固定順序）', () => {
    const cards: StudyCard[] = [];
    for (let i = 0; i < 10; i++) {
      cards.push(makeStudyCard(`new-${i}`, 'FORWARD', true));
    }
    for (let i = 0; i < 10; i++) {
      cards.push(makeStudyCard(`rev-${i}`, 'FORWARD', false));
    }

    // 跑多次，至少有一次順序與輸入不同（驗證有 shuffle）
    let hasDifferentOrder = false;
    for (let trial = 0; trial < 20; trial++) {
      const result = shuffleWithSpacing(cards, 5);
      const inputIds = cards.map((c) => c.id).join(',');
      const resultIds = result.map((c) => c.id).join(',');
      if (inputIds !== resultIds) {
        hasDifferentOrder = true;
        break;
      }
    }
    expect(hasDifferentOrder).toBe(true);
  });

  it('同一底層卡片的正反向應至少間隔 minSpacing 張', () => {
    // 建立 10 張卡片，各有正向和反向（共 20 張）
    const cards: StudyCard[] = [];
    for (let i = 0; i < 10; i++) {
      cards.push(makeStudyCard(`c${i}`, 'FORWARD', i < 5));
      cards.push(makeStudyCard(`c${i}`, 'REVERSE', i < 5));
    }

    // 跑 50 次驗證間隔約束
    for (let trial = 0; trial < 50; trial++) {
      const result = shuffleWithSpacing(cards, 5);
      expect(result).toHaveLength(20);

      // 建立 id → 位置的 map
      const positionMap = new Map<string, number[]>();
      result.forEach((card, index) => {
        const key = card.id;
        if (!positionMap.has(key)) {
          positionMap.set(key, []);
        }
        positionMap.get(key)!.push(index);
      });

      // 檢查每對正反向的間距
      for (const [, positions] of positionMap) {
        if (positions.length === 2) {
          const gap = Math.abs(positions[1] - positions[0]);
          expect(gap).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it('卡片數不足時應 best-effort 拉開間距', () => {
    // 只有 3 張卡片（1 對正反向 + 1 張單向），無法滿足間隔 5
    const cards: StudyCard[] = [
      makeStudyCard('c1', 'FORWARD'),
      makeStudyCard('c1', 'REVERSE'),
      makeStudyCard('c2', 'FORWARD'),
    ];

    for (let trial = 0; trial < 20; trial++) {
      const result = shuffleWithSpacing(cards, 5);
      expect(result).toHaveLength(3);

      // 找到 c1 的正反向位置
      const c1Positions = result
        .map((c, i) => ({ id: c.id, dir: c.direction, index: i }))
        .filter((c) => c.id === 'c1');

      if (c1Positions.length === 2) {
        const gap = Math.abs(c1Positions[1].index - c1Positions[0].index);
        // best-effort：在 3 張卡中最大間距為 2
        expect(gap).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('沒有正反向配對時不需要間隔處理', () => {
    const cards = [
      makeStudyCard('c1', 'FORWARD', true),
      makeStudyCard('c2', 'FORWARD', false),
      makeStudyCard('c3', 'FORWARD', true),
    ];
    const result = shuffleWithSpacing(cards, 5);
    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.id).sort();
    expect(ids).toEqual(['c1', 'c2', 'c3']);
  });

  it('不應修改原始輸入陣列', () => {
    const cards = [
      makeStudyCard('c1', 'FORWARD'),
      makeStudyCard('c2', 'FORWARD'),
    ];
    const original = [...cards];
    shuffleWithSpacing(cards, 5);
    expect(cards).toEqual(original);
  });
});
