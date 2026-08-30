const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateReviewDraft,
  validateStructure,
  canonicalJson,
  speakingSourceKey,
  nextVocabularyStatus,
  containsTerm,
} = require("../dist/index.js");
const fixture = require("./review.fixture.json");
const draft = () => structuredClone(fixture);
const words = [{ id: "word-walk", term: "walk", status: "UNSEEN" }];
const check = (value) =>
  validateReviewDraft(value, {
    userId: "user-1",
    apiOrigin: "https://flashmind.example",
    words,
  });

test("完整草稿可驗證且不改寫原輸入", () => {
  const value = draft();
  const before = JSON.stringify(value);
  assert.deepEqual(check(value), []);
  assert.equal(JSON.stringify(value), before);
});
for (const [name, mutate, code] of [
  [
    "未知欄位",
    (x) => {
      x.approved = true;
    },
    "SCHEMA_INVALID",
  ],
  [
    "音訊",
    (x) => {
      x.practice.messages[0].audioBase64 = "data";
    },
    "SCHEMA_INVALID",
  ],
  [
    "重複訊息",
    (x) => {
      x.practice.messages[1].id = "u1";
    },
    "MESSAGE_DUPLICATE",
  ],
  [
    "時間倒序",
    (x) => {
      x.practice.endedAt = "2020-01-01T00:00:00Z";
    },
    "TIME_INVALID",
  ],
  [
    "範圍不存在",
    (x) => {
      x.practice.range.lastMessageId = "missing";
    },
    "RANGE_INVALID",
  ],
  [
    "助理證據",
    (x) => {
      x.result.actualUses[0].evidence[0] = {
        messageId: "a1",
        quote: "Who do you usually go with?",
      };
    },
    "EVIDENCE_INVALID",
  ],
  [
    "假引文",
    (x) => {
      x.result.actualUses[0].evidence[0].quote = "I walk somewhere else.";
    },
    "EVIDENCE_INVALID",
  ],
  [
    "只含較長字串",
    (x) => {
      x.practice.messages[0].text = "I use a sidewalk.";
      x.result.actualUses[0].evidence[0].quote = x.practice.messages[0].text;
    },
    "TERM_NOT_USED",
  ],
  [
    "不明字形",
    (x) => {
      x.practice.messages[0].text = "I walked home.";
      x.result.actualUses[0].evidence[0].quote = x.practice.messages[0].text;
    },
    "TERM_NOT_USED",
  ],
  [
    "其他帳號",
    (x) => {
      x.target.userId = "another-user";
    },
    "ACCOUNT_MISMATCH",
  ],
  [
    "其他環境",
    (x) => {
      x.target.apiOrigin = "https://another.example";
    },
    "ENVIRONMENT_MISMATCH",
  ],
  [
    "未知單字",
    (x) => {
      x.result.actualUses[0].targetVocabularyId = "unknown";
    },
    "TARGET_NOT_FOUND",
  ],
  [
    "同字同類重複",
    (x) => {
      x.result.actualUses.push(structuredClone(x.result.actualUses[0]));
    },
    "EVENT_DUPLICATE",
  ],
  [
    "未使用卻列為候選",
    (x) => {
      x.result.deckCandidates = ["unknown"];
    },
    "CANDIDATE_INVALID",
  ],
  [
    "缺使用者對話",
    (x) => {
      x.practice.messages[0].role = "assistant";
    },
    "USER_MESSAGE_REQUIRED",
  ],
  [
    "本機新紀錄沒有逐字稿",
    (x) => {
      x.practice.messages[0].text = "";
      x.practice.messages[0].transcriptStatus = "unavailable";
    },
    "TRANSCRIPT_REQUIRED",
  ],
])
  test(`拒絕${name}`, () => {
    const value = draft();
    mutate(value);
    assert.ok(
      check(value).some((issue) => issue.code === code),
      JSON.stringify(check(value)),
    );
  });
test("允許空單字事件與推薦", () => {
  const value = draft();
  value.result.actualUses = [];
  value.result.deckCandidates = [];
  assert.deepEqual(check(value), []);
});
test("同字可有使用與推薦各一次", () => {
  const value = draft();
  const { evidence, ...use } = value.result.actualUses[0];
  value.result.recommendations = [
    { ...use, recommendationReason: "延伸使用情境" },
  ];
  assert.deepEqual(check(value), []);
});
test("輸入結構錯誤以欄位路徑回報，不丟例外", () => {
  assert.ok(validateStructure("SpeakingReviewDraft", null).length);
  assert.ok(
    validateStructure("SpeakingReviewDraft", { schemaVersion: 2 }).every(
      (x) => typeof x.path === "string",
    ),
  );
});
test("穩定來源 key 不受 title 或每次操作影響", () => {
  const value = draft();
  const key = speakingSourceKey(value.practice.sourceRef);
  value.practice.title = "修正標題";
  assert.equal(speakingSourceKey(value.practice.sourceRef), key);
  assert.notEqual(
    speakingSourceKey({
      ...value.practice.sourceRef,
      sessionKey: "practice-2",
    }),
    key,
  );
});
test("正規化 JSON 忽略 object key 順序但保留訊息順序", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});
test("日期指紋保留 ISO 時間，不能把不同時間當成同一則訊息", () => {
  assert.notEqual(
    canonicalJson({ time: new Date("2026-08-30T00:00:00Z") }),
    canonicalJson({ time: new Date("2026-08-31T00:00:00Z") }),
  );
});
test("四種狀態不降級", () => {
  assert.equal(nextVocabularyStatus("UNSEEN", "recommendation"), "PRACTICING");
  assert.equal(nextVocabularyStatus("UNSEEN", "actual-use"), "USED");
  assert.equal(nextVocabularyStatus("PRACTICING", "actual-use"), "USED");
  assert.equal(nextVocabularyStatus("USED", "recommendation"), "USED");
  assert.equal(nextVocabularyStatus("ADDED", "actual-use"), "ADDED");
});
test("單詞邊界與大小寫匹配，不計同義字或 substring", () => {
  assert.equal(containsTerm("I WALK home.", "walk"), true);
  assert.equal(containsTerm("I visit a website.", "site"), false);
  assert.equal(containsTerm("I figure   out the answer.", "figure out"), true);
});
