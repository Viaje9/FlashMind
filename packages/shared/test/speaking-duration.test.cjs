const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateSpeakingDurationMinutes } = require("../dist");

test("以練習起訖估算整分鐘，包含跨日與不同時區", () => {
  assert.equal(estimateSpeakingDurationMinutes("2026-08-30T07:29:48.987Z", "2026-08-30T07:44:47.394Z"), 15);
  assert.equal(estimateSpeakingDurationMinutes("2026-08-30T23:55:00+08:00", "2026-08-30T16:10:00Z"), 15);
});

test("不到一分鐘以 0 表示，包括只有同一時間點的紀錄", () => {
  assert.equal(estimateSpeakingDurationMinutes("2026-08-30T07:00:00Z", "2026-08-30T07:00:59Z"), 0);
  assert.equal(estimateSpeakingDurationMinutes("2026-08-30T07:00:00Z", "2026-08-30T07:00:00Z"), 0);
});

test("缺少、無效或倒序時間保持未知，不誤算為零分鐘", () => {
  for (const [start, end] of [
    [undefined, "2026-08-30T07:00:00Z"],
    ["2026-08-30T07:00:00Z", null],
    ["invalid", "2026-08-30T07:00:00Z"],
    ["2026-08-30T07:00:00Z", ""],
    ["2026-08-30T07:01:00Z", "2026-08-30T07:00:00Z"],
  ]) assert.equal(estimateSpeakingDurationMinutes(start, end), null);
});
