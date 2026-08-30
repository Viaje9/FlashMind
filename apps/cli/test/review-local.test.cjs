const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const fixture = require("../../../packages/shared/test/review.fixture.json");
const bin = path.resolve(__dirname, "../bin/flashmind.cjs");
const thread = "01a05192-bc7b-7a10-a74b-413afacec824";

async function setup(t) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "flashmind-review-test-"),
  );
  const config = path.join(root, "config"),
    data = path.join(root, "data");
  await fs.mkdir(config, { mode: 0o700 });
  await fs.mkdir(path.join(root, "sessions"));
  const events = [
    { type: "session_meta", payload: { id: thread } },
    ...[
      ...fixture.practice.messages,
      {
        id: "end",
        role: "user",
        text: "Stop here",
        createdAt: "2026-08-30T10:02:00+08:00",
      },
    ].map((m) => ({
      type: "realtime_item",
      timestamp: m.createdAt,
      payload: {
        type: "transcript_segment",
        id: m.id,
        role: m.role,
        text: m.text,
        realtime_session_id: "voice-1",
      },
    })),
  ];
  const source = path.join(root, "sessions", `rollout-${thread}.jsonl`);
  await fs.writeFile(source, events.map((e) => JSON.stringify(e)).join("\n"));
  const context = {
    schemaVersion: 1,
    userId: "user-1",
    generatedAt: new Date().toISOString(),
    vocabularyVersion: "v1",
    vocabularyCount: 1,
    targetVocabulary: [
      {
        id: "word-walk",
        term: "walk",
        zhMeaning: "散步",
        status: "UNSEEN",
        useCount: 0,
        recommendationCount: 0,
        expressionContext: null,
        naturalSentence: null,
        recommendationReason: null,
        addedCardId: null,
      },
    ],
    lastPractice: null,
    nextPractice: null,
  };
  const requests = [];
  let failContext = false;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
    requests.push({ method: req.method, url: req.url, body });
    res.setHeader("content-type", "application/json");
    if (req.url.endsWith("practice-context")) {
      res.statusCode = failContext ? 500 : 200;
      res.end(JSON.stringify({ data: context }));
    } else if (req.url.endsWith("/validate")) {
      res.end(
        JSON.stringify({
          data: { valid: true, contentHash: "hash", errors: [], warnings: [] },
        }),
      );
    } else {
      res.end(
        JSON.stringify({
          data: {
            sessionId: "saved-session",
            reviewId: "saved-review",
            status: "saved",
            actualUseCount: 1,
            recommendationCount: 0,
          },
        }),
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const credential = path.join(
    config,
    createHash("sha256").update(origin).digest("hex") + ".json",
  );
  await fs.writeFile(
    credential,
    JSON.stringify({
      schemaVersion: 1,
      apiOrigin: origin,
      userId: "user-1",
      email: "test@example.test",
      token: "test-secret",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    }),
    { mode: 0o600 },
  );
  const resultFile = path.join(root, "result.json");
  await fs.writeFile(resultFile, JSON.stringify(fixture.result), {
    mode: 0o600,
  });
  const run = (args, env = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [bin, ...args], {
        cwd: os.tmpdir(),
        env: {
          ...process.env,
          CODEX_HOME: root,
          FLASHMIND_CONFIG_DIR: config,
          FLASHMIND_DATA_DIR: data,
          FLASHMIND_API_URL: origin,
          ...env,
        },
      });
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (v) => (stdout += v));
      child.stderr.on("data", (v) => (stderr += v));
      child.on("error", reject);
      child.on("close", (code) =>
        resolve({ code, stdout, stderr, json: () => JSON.parse(stdout) }),
      );
    });
  const prepare = () =>
    run([
      "review",
      "prepare",
      thread,
      "--before-message",
      "end",
      "--title",
      "週末散步",
    ]);
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await fs.rm(root, { recursive: true, force: true });
  });
  return {
    root,
    data,
    config,
    origin,
    source,
    events,
    credential,
    context,
    requests,
    run,
    prepare,
    resultFile,
    failContext: () => {
      failContext = true;
    },
  };
}

test("prepare 保存完整資料且同場重用；離線分頁查閱不依賴登入或傳送原文", async (t) => {
  const s = await setup(t);
  const first = await s.prepare();
  assert.equal(first.code, 0, first.stdout);
  const { id, path: file } = first.json();
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(file))).mode & 0o777, 0o700);
  assert.doesNotMatch(await fs.readFile(file, "utf8"), /test-secret/);
  assert.equal((await s.prepare()).json().id, id);
  await fs.rm(s.config, { recursive: true });
  const offline = {
    FLASHMIND_CONFIG_DIR: "/not-accessible/config",
    FLASHMIND_API_URL: "invalid",
  };
  const page = (
    await s.run(
      ["review", "show", id, "--section", "transcript", "--limit", "1"],
      offline,
    )
  ).json();
  assert.equal(page.total, 2);
  assert.equal(page.nextOffset, 1);
  assert.deepEqual(page.messages[0], fixture.practice.messages[0]);
  const last = (
    await s.run(
      ["review", "show", id, "--section", "transcript", "--offset", "1"],
      offline,
    )
  ).json();
  assert.equal(last.messages[0].id, "a1");
  assert.equal(last.nextOffset, null);
  const vocab = (
    await s.run(
      ["review", "vocabulary", id, "--terms", "walk,missing"],
      offline,
    )
  ).json();
  assert.equal(vocab.words[0].id, "word-walk");
  assert.deepEqual(vocab.missingTerms, ["missing"]);
  const list = (await s.run(["review", "list"], offline)).json();
  assert.equal(list.reviews[0].id, id);
  assert.equal(list.reviews[0].status, "prepared");
  assert.equal(s.requests.length, 2);
  assert.ok(s.requests.every((r) => r.method === "GET" && !r.body));
});

test("validate 離線唯讀、無憑證也驗證字庫與原文；save 僅上傳一次至保存 API", async (t) => {
  const s = await setup(t);
  const prepared = await s.prepare();
  assert.equal(prepared.code, 0, prepared.stdout);
  const { id, path: file } = prepared.json();
  const update = await s.run([
    "review",
    "update",
    id,
    "--result",
    s.resultFile,
  ]);
  assert.equal(update.code, 0, update.stdout);
  const before = await fs.readFile(file, "utf8");
  const validation = await s.run(["review", "validate", id], {
    FLASHMIND_CONFIG_DIR: "/not-accessible/config",
    FLASHMIND_API_URL: "invalid",
  });
  assert.equal(validation.code, 0, validation.stdout);
  assert.equal(validation.json().valid, true);
  assert.equal(validation.json().scope, "local-snapshot");
  assert.equal(validation.json().uploaded, false);
  assert.equal(await fs.readFile(file, "utf8"), before);
  assert.equal(
    (await s.run(["review", "check", id])).json().error.code,
    "USAGE_ERROR",
  );
  const bad = structuredClone(fixture.result);
  bad.actualUses[0].evidence[0].messageId = "a1";
  await fs.writeFile(s.resultFile, JSON.stringify(bad));
  assert.notEqual(
    (await s.run(["review", "update", id, "--result", s.resultFile])).code,
    0,
  );
  assert.equal(await fs.readFile(file, "utf8"), before);
  bad.actualUses[0].evidence[0].messageId = "u1";
  bad.actualUses[0].targetVocabularyId = "foreign-word";
  await fs.writeFile(s.resultFile, JSON.stringify(bad));
  assert.notEqual(
    (await s.run(["review", "update", id, "--result", s.resultFile])).code,
    0,
  );
  assert.equal(s.requests.length, 1);
  const draft = (
    await s.run(["review", "show", id, "--section", "draft"])
  ).json();
  assert.equal(draft.practice.sourceRef.sessionKey, "u1");
  assert.equal((await s.run(["review", "validate", id])).code, 0);
  assert.equal(s.requests.length, 1);
  assert.equal(
    (await s.run(["review", "show", id])).json().status,
    "validated",
  );
  assert.equal(
    (await s.run(["review", "save", id])).json().sessionId,
    "saved-session",
  );
  assert.equal((await s.run(["review", "show", id])).json().status, "saved");
  assert.deepEqual(
    s.requests.slice(1).map((r) => r.body),
    [draft],
  );
  assert.equal(s.requests[1].url, "/api/speaking/reviews");
});

test("refresh 失敗保留舊檔，刷新後舊草稿標示過期，不暗中改寫或跨帳號", async (t) => {
  const s = await setup(t);
  const prepared = await s.prepare();
  assert.equal(prepared.code, 0, prepared.stdout);
  const { id, path: file } = prepared.json();
  await s.run(["review", "update", id, "--result", s.resultFile]);
  s.context.vocabularyVersion = "v2";
  assert.equal((await s.run(["review", "refresh", id])).code, 0);
  assert.equal((await s.run(["review", "validate", id])).json().valid, false);
  assert.equal(
    (await s.run(["review", "show", id])).json().status,
    "context-stale",
  );
  const calls = s.requests.length;
  assert.notEqual((await s.run(["review", "validate", id])).code, 0);
  assert.equal(s.requests.length, calls);
  assert.equal(
    (await s.run(["review", "update", id, "--result", s.resultFile])).code,
    0,
  );
  const before = await fs.readFile(file, "utf8");
  s.failContext();
  assert.notEqual((await s.run(["review", "refresh", id])).code, 0);
  assert.equal(await fs.readFile(file, "utf8"), before);
  const cred = JSON.parse(await fs.readFile(s.credential));
  cred.userId = "other-user";
  await fs.writeFile(s.credential, JSON.stringify(cred));
  const count = s.requests.length;
  assert.equal(
    (await s.run(["review", "refresh", id])).json().error.code,
    "TARGET_MISMATCH",
  );
  assert.equal(
    (await s.run(["review", "save", id])).json().error.code,
    "TARGET_MISMATCH",
  );
  assert.equal(s.requests.length, count);
});

test("拒絕來源內容變更、越界 ID、符號連結與 repo 內資料目錄", async (t) => {
  const s = await setup(t);
  const prepared = await s.prepare();
  assert.equal(prepared.code, 0, prepared.stdout);
  const { id, path: file } = prepared.json();
  const before = await fs.readFile(file, "utf8");
  s.events[1].payload.text = "changed source";
  await fs.writeFile(
    s.source,
    s.events.map((e) => JSON.stringify(e)).join("\n"),
  );
  assert.equal((await s.prepare()).json().error.code, "SOURCE_CONFLICT");
  assert.equal(await fs.readFile(file, "utf8"), before);
  assert.notEqual((await s.run(["review", "show", "../../secret"])).code, 0);
  const repoPath = path.resolve(__dirname, "../private-review-data");
  assert.equal(
    (await s.run(["review", "list"], { FLASHMIND_DATA_DIR: repoPath })).json()
      .error.code,
    "DATA_UNSAFE",
  );
  await assert.rejects(fs.stat(repoPath), { code: "ENOENT" });
  const external = path.join(s.root, "external.json");
  await fs.rename(file, external);
  await fs.symlink(external, file);
  assert.notEqual((await s.run(["review", "show", id])).code, 0);
  assert.equal(await fs.readFile(external, "utf8"), before);
});

test("prepare 必須指定結束邊界；新資料目錄的 list 不建立資料", async (t) => {
  const s = await setup(t);
  const list = await s.run(["review", "list"]);
  assert.equal(list.code, 0, list.stdout);
  assert.deepEqual(list.json().reviews, []);
  await assert.rejects(fs.stat(s.data), { code: "ENOENT" });
  assert.notEqual((await s.run(["review", "prepare", thread])).code, 0);
  assert.equal(s.requests.length, 0);
});

test("import 保留舊來源 key 與逐字稿、只讀最新 context，更新後可本機檢查", async (t) => {
  const s = await setup(t);
  const draft = structuredClone(fixture);
  draft.target.apiOrigin = s.origin;
  const file = path.join(s.root, "old-draft.json");
  await fs.writeFile(file, JSON.stringify(draft), { mode: 0o600 });
  const imported = await s.run(["review", "import", "--file", file]);
  assert.equal(imported.code, 0, imported.stdout);
  const { id, status } = imported.json();
  assert.equal(status, "context-stale");
  assert.deepEqual(
    (await s.run(["review", "show", id, "--section", "draft"])).json(),
    draft,
  );
  assert.equal(
    (await s.run(["review", "import", "--file", file])).json().id,
    id,
  );
  assert.equal(
    (await s.run(["review", "update", id, "--result", s.resultFile])).code,
    0,
  );
  const updated = (
    await s.run(["review", "show", id, "--section", "draft"])
  ).json();
  assert.deepEqual(updated.practice, draft.practice);
  assert.equal(updated.contextVersion, "v1");
  assert.equal((await s.run(["review", "validate", id])).json().valid, true);
  assert.ok(s.requests.every((r) => r.method === "GET" && !r.body));
  assert.equal(
    (await s.run(["review", "import", "--file", file])).json().error.code,
    "SOURCE_CONFLICT",
  );
});

test("不同帳號各自保存同一來源，不共用草稿 ID 或讀取結果", async (t) => {
  const s = await setup(t);
  const first = await s.prepare();
  assert.equal(first.code, 0, first.stdout);
  const cred = JSON.parse(await fs.readFile(s.credential));
  cred.userId = "user-2";
  await fs.writeFile(s.credential, JSON.stringify(cred));
  s.context.userId = "user-2";
  const second = await s.prepare();
  assert.equal(second.code, 0, second.stdout);
  assert.notEqual(first.json().id, second.json().id);
  assert.equal(
    (await s.run(["review", "show", first.json().id])).json().target.userId,
    "user-1",
  );
  assert.equal(
    (await s.run(["review", "show", second.json().id])).json().target.userId,
    "user-2",
  );
  assert.equal((await s.run(["review", "list"])).json().total, 2);
});

test("同時更新的鎖、非私有檔案與資料根目錄 symlink 不會覆蓋既有草稿", async (t) => {
  const s = await setup(t);
  const prepared = await s.prepare();
  assert.equal(prepared.code, 0, prepared.stdout);
  const { id, path: file } = prepared.json();
  const before = await fs.readFile(file, "utf8");
  const lock = path.join(path.dirname(file), ".lock");
  await fs.mkdir(lock, { mode: 0o700 });
  assert.equal(
    (await s.run(["review", "update", id, "--result", s.resultFile])).json()
      .error.code,
    "REVIEW_BUSY",
  );
  assert.equal(await fs.readFile(file, "utf8"), before);
  await fs.rmdir(lock);
  await fs.chmod(file, 0o644);
  assert.equal(
    (await s.run(["review", "show", id])).json().error.code,
    "DATA_UNSAFE",
  );
  await fs.chmod(file, 0o600);
  const alias = path.join(s.root, "data-alias");
  await fs.symlink(s.data, alias, "dir");
  assert.equal(
    (await s.run(["review", "list"], { FLASHMIND_DATA_DIR: alias })).json()
      .error.code,
    "DATA_UNSAFE",
  );
  assert.equal(await fs.readFile(file, "utf8"), before);
});

test("錯誤選項與超大結果不進行連線，已保存紀錄不可改成另一份內容", async (t) => {
  const s = await setup(t);
  const prepared = await s.prepare();
  assert.equal(prepared.code, 0, prepared.stdout);
  const { id } = prepared.json();
  for (const args of [
    ["show", id, "--section", "unknown"],
    ["show", id, "--limit", "0"],
    ["vocabulary", id, "--offset", "-1"],
    ["list", "--limit", "201"],
    ["show", id, "--offset", "0", "--offset", "1"],
    ["update", id],
  ])
    assert.equal((await s.run(["review", ...args])).code, 2);
  assert.equal(s.requests.length, 1);
  await fs.writeFile(s.resultFile, " ".repeat(2 * 1024 * 1024 + 1));
  assert.equal(
    (await s.run(["review", "update", id, "--result", s.resultFile])).json()
      .error.code,
    "PAYLOAD_TOO_LARGE",
  );
  await fs.writeFile(s.resultFile, JSON.stringify(fixture.result));
  await s.run(["review", "update", id, "--result", s.resultFile]);
  assert.equal((await s.run(["review", "save", id])).code, 0);
  await fs.writeFile(
    s.resultFile,
    JSON.stringify({ ...fixture.result, summary: "A different summary." }),
  );
  assert.equal(
    (await s.run(["review", "update", id, "--result", s.resultFile])).json()
      .error.code,
    "REVIEW_ALREADY_SAVED",
  );
  assert.equal((await s.run(["review", "show", id])).json().status, "saved");
});
