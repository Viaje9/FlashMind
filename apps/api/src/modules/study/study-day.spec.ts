import { getStartOfStudyDay } from './study-day';

describe('getStartOfStudyDay', () => {
  it('當前時間已過 resetHour，應回傳今天的 resetHour', () => {
    // 2026-01-20 10:00，resetHour = 4
    const now = new Date('2026-01-20T10:00:00');
    const result = getStartOfStudyDay(now, 4);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(4);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('當前時間尚未到 resetHour，應回傳昨天的 resetHour', () => {
    // 2026-01-20 02:00，resetHour = 4
    const now = new Date('2026-01-20T02:00:00');
    const result = getStartOfStudyDay(now, 4);

    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(4);
  });

  it('當前時間恰好等於 resetHour，應回傳今天的 resetHour', () => {
    // 2026-01-20 04:00:00.000
    const now = new Date('2026-01-20T04:00:00.000');
    const result = getStartOfStudyDay(now, 4);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(4);
  });

  it('resetHour = 0 時，午夜後應回傳今天 0 點', () => {
    const now = new Date('2026-01-20T01:00:00');
    const result = getStartOfStudyDay(now, 0);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(0);
  });

  it('resetHour = 0 時，午夜前 23:59 應回傳今天 0 點', () => {
    const now = new Date('2026-01-20T23:59:00');
    const result = getStartOfStudyDay(now, 0);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(0);
  });

  it('resetHour = 23 時，23:30 應回傳今天 23 點', () => {
    const now = new Date('2026-01-20T23:30:00');
    const result = getStartOfStudyDay(now, 23);

    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(23);
  });

  it('resetHour = 23 時，22:00 應回傳昨天 23 點', () => {
    const now = new Date('2026-01-20T22:00:00');
    const result = getStartOfStudyDay(now, 23);

    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(23);
  });
});
