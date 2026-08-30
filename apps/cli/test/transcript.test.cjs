const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const bin = path.resolve(__dirname, "../bin/flashmind.cjs");
const id = "01a05192-bc7b-7a10-a74b-413afacec824";
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "transcript-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "sessions"));
  const events = [
    { type: "session_meta", payload: { id } },
    ...[
      ["a", "assistant", "Hello"],
      ["u", "user", " I check another task. "],
      ["end", "user", "Stop here"],
      ["review", "assistant", "Review"],
    ].map(([id, role, text], i) => ({
      type: "realtime_item",
      timestamp: `2026-08-30T07:30:0${i}.000Z`,
      payload: {
        type: "transcript_segment",
        id,
        role,
        text,
        realtime_session_id: "session-1",
      },
    })),
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ text: "duplicate handoff" }],
      },
    },
  ];
  const file = path.join(root, "sessions", `rollout-${id}.jsonl`);
  const write = () =>
    fs.writeFile(file, events.map((x) => JSON.stringify(x)).join("\n"));
  await write();
  const run = (...args) =>
    spawnSync(
      process.execPath,
      [bin, "transcript", "export", `codex://threads/${id}`, ...args],
      {
        encoding: "utf8",
        env: { ...process.env, CODEX_HOME: root, FLASHMIND_API_URL: "" },
      },
    );
  return { root, events, write, run };
}
test("離線保留原文與 ID，排除結束訊息、Review 及 handoff", async (t) => {
  const { run } = await fixture(t);
  const r = run("--before-message", "end");
  assert.equal(r.status, 0, r.stdout);
  const p = JSON.parse(r.stdout).practice;
  assert.deepEqual(
    p.messages.map((x) => x.id),
    ["a", "u"],
  );
  assert.equal(p.messages[1].text, " I check another task. ");
  assert.equal(p.sourceRef.sessionKey, "a");
});
test("缺少邊界不猜測，錯誤邊界拒絕", async (t) => {
  const { run } = await fixture(t);
  assert.equal(JSON.parse(run().stdout).reviewReady, false);
  assert.equal(
    JSON.parse(run("--from-message", "a").stdout).error.code,
    "BOUNDARY_REQUIRED",
  );
  assert.equal(
    JSON.parse(run("--before-message", "missing").stdout).error.code,
    "BOUNDARY_INVALID",
  );
});
test("私有檔案且不覆蓋既有檔案", async (t) => {
  const { run, root } = await fixture(t);
  const output = path.join(root, "result.json");
  assert.equal(run("--before-message", "end", "--output", output).status, 0);
  assert.equal((await fs.stat(output)).mode & 0o777, 0o600);
  assert.notEqual(run("--before-message", "end", "--output", output).status, 0);
});
test("多場次須指定開始訊息，損壞資料拒絕", async (t) => {
  const { run, events, write } = await fixture(t);
  events[2].payload.realtime_session_id = "session-2";
  await write();
  assert.equal(
    JSON.parse(run("--before-message", "end").stdout).error.code,
    "SESSION_AMBIGUOUS",
  );
  events[2].payload.realtime_session_id = "session-1";
  events[2].timestamp = "invalid";
  await write();
  assert.equal(
    JSON.parse(run("--before-message", "end").stdout).error.code,
    "TRANSCRIPT_INVALID",
  );
});
test("列表供核對邊界，多場次指定起點後只匯出該場", async (t) => {
  const { run, events, write } = await fixture(t);
  const list = JSON.parse(run("--list").stdout);
  assert.deepEqual(
    list.messages.map((m) => m.id),
    ["a", "u", "end", "review"],
  );
  events[1].payload.realtime_session_id = "previous-session";
  await write();
  const result = run("--from-message", "u", "--before-message", "end");
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(
    JSON.parse(result.stdout).practice.messages.map((m) => m.id),
    ["u"],
  );
});
test("損壞 JSON 與錯誤來源不輸出部分資料", async (t) => {
  const { run, events, write, root } = await fixture(t);
  events[0].payload.id = "another-thread";
  await write();
  assert.equal(JSON.parse(run("--list").stdout).error.code, "SOURCE_MISMATCH");
  await fs.appendFile(
    path.join(root, "sessions", `rollout-${id}.jsonl`),
    '\n{"unfinished":',
  );
  assert.equal(
    JSON.parse(run("--list").stdout).error.code,
    "TRANSCRIPT_INVALID",
  );
});
test("沒有原始語音訊息不退回 handoff 摘要", async (t) => {
  const { run, events, write } = await fixture(t);
  events.splice(1, 4);
  await write();
  assert.equal(
    JSON.parse(run("--list").stdout).error.code,
    "TRANSCRIPT_UNAVAILABLE",
  );
});

test("--current 使用當前任務，無邊界時回傳明確標示的原始快照", async (t) => {
  const { root } = await fixture(t);
  const run = (...args) =>
    spawnSync(process.execPath, [bin, "transcript", "export", ...args], {
      encoding: "utf8",
      env: { ...process.env, CODEX_HOME: root, CODEX_THREAD_ID: id },
    });
  const raw = run("--current");
  assert.equal(raw.status, 0, raw.stdout);
  const snapshot = JSON.parse(raw.stdout);
  assert.equal(snapshot.conversationId, id);
  assert.equal(snapshot.reviewReady, false);
  assert.equal(snapshot.messages.length, 4);
  assert.equal(snapshot.practice, undefined);
  const bounded = run("--current", "--before-message", "end");
  assert.equal(bounded.status, 0, bounded.stdout);
  assert.equal(JSON.parse(bounded.stdout).practice.messages.length, 2);
  const temp = run("--current", "--output", path.join(root, "snapshot.json"));
  assert.equal(temp.status, 0, temp.stdout);
  assert.equal(JSON.parse(temp.stdout).messageCount, 4);
  assert.equal(run("--current", id).status, 2);
  assert.equal(run(id, "--current").status, 2);
  assert.equal(run("--current", "--current").status, 2);
});

test("--current 缺少或不合法的環境 ID 不猜最近任務；指定任務不受環境影響", async (t) => {
  const { root } = await fixture(t);
  for (const threadId of ["", "invalid"]) {
    const run = (...args) =>
      spawnSync(process.execPath, [bin, "transcript", "export", ...args], {
        encoding: "utf8",
        env: { ...process.env, CODEX_HOME: root, CODEX_THREAD_ID: threadId },
      });
    assert.equal(
      JSON.parse(run("--current").stdout).error.code,
      threadId ? "CURRENT_THREAD_INVALID" : "CURRENT_THREAD_REQUIRED",
    );
    assert.equal(run(id, "--before-message", "end").status, 0);
    assert.equal(run().status, 2);
  }
});

test("show 分頁保留原文與邊界訊息，最後一頁明確結束且拒絕非法參數", async (t) => {
  const { root } = await fixture(t);
  const run = (...args) =>
    spawnSync(process.execPath, [bin, "transcript", "show", id, ...args], {
      encoding: "utf8",
      env: { ...process.env, CODEX_HOME: root },
    });
  const first = JSON.parse(run("--limit", "2").stdout);
  assert.equal(first.total, 4);
  assert.equal(first.nextOffset, 2);
  assert.equal(first.reviewReady, false);
  assert.equal(first.messages[1].text, " I check another task. ");
  const last = JSON.parse(run("--offset", "2", "--limit", "2").stdout);
  assert.deepEqual(
    last.messages.map((m) => m.id),
    ["end", "review"],
  );
  assert.equal(last.nextOffset, null);
  for (const args of [
    ["--limit", "0"],
    ["--limit", "201"],
    ["--offset", "-1"],
    ["--output", "file"],
    ["--offset", "0", "--offset", "1"],
  ])
    assert.equal(run(...args).status, 2);
});
