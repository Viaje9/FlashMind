const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const bin = path.resolve(__dirname, "../bin/flashmind.cjs");
const fixture = require("../../../packages/shared/test/review.fixture.json");

async function setup(t, handler) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flashmind-cli-"));
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : undefined;
    res.setHeader("content-type", "application/json");
    try {
      await handler(req, res, body);
    } catch {
      res.statusCode = 500;
      res.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const credential = path.join(
    dir,
    createHash("sha256").update(origin).digest("hex") + ".json",
  );
  await fs.writeFile(
    credential,
    JSON.stringify({
      schemaVersion: 1,
      apiOrigin: origin,
      userId: "user-1",
      email: "test@example.test",
      token: "private-session",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    }),
    { mode: 0o600 },
  );
  const draft = structuredClone(fixture);
  draft.target.apiOrigin = origin;
  const file = path.join(dir, "review.json");
  await fs.writeFile(file, JSON.stringify(draft));
  const run = (args, env = {}) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [bin, ...args], {
        cwd: os.tmpdir(),
        env: {
          ...process.env,
          FLASHMIND_API_URL: origin,
          FLASHMIND_CONFIG_DIR: dir,
          ...env,
        },
      });
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (v) => (stdout += v));
      child.stderr.on("data", (v) => (stderr += v));
      child.on("exit", (code) =>
        resolve({ code, stdout, stderr, json: () => JSON.parse(stdout) }),
      );
    });
  return { dir, origin, file, draft, credential, run };
}
test("四個命令 help 與無效參數有清楚結果", async (t) => {
  const { run } = await setup(t, (_, res) => res.end("{}"));
  for (const args of [
    ["--help"],
    ["login", "--help"],
    ["practice", "context", "--help"],
    ["review", "validate", "--help"],
    ["review", "save", "--help"],
  ]) {
    const result = await run(args);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /flashmind/);
  }
  const bad = await run(["review", "save"]);
  assert.equal(bad.code, 2);
  assert.equal(bad.json().error.code, "USAGE_ERROR");
});
test("context 回傳完整 JSON 且 Cookie 只送設定的 origin", async (t) => {
  const context = {
    schemaVersion: 1,
    userId: "user-1",
    generatedAt: new Date().toISOString(),
    vocabularyVersion: "version-1",
    vocabularyCount: 0,
    targetVocabulary: [],
    lastPractice: null,
    nextPractice: null,
  };
  const { run } = await setup(t, (req, res) => {
    assert.equal(req.headers.cookie, "session=private-session");
    assert.equal(req.url, "/api/speaking/practice-context");
    res.end(JSON.stringify({ data: context }));
  });
  const result = await run(["practice", "context"]);
  assert.equal(result.code, 0);
  assert.deepEqual(result.json(), context);
  assert.doesNotMatch(result.stdout + result.stderr, /private-session/);
});
test("拒絕不完整 context 與不同帳號", async (t) => {
  const { run } = await setup(t, (_, res) =>
    res.end(
      JSON.stringify({ data: { vocabularyCount: 1, targetVocabulary: [] } }),
    ),
  );
  const result = await run(["practice", "context"]);
  assert.equal(result.code, 4);
  assert.equal(result.json().error.code, "CONTEXT_INVALID");
});
test("validate 唯讀；save 固定快照，線上驗證後才送保存", async (t) => {
  const requests = [];
  const { run, file, draft } = await setup(t, (req, res, body) => {
    requests.push({ url: req.url, body });
    res.end(
      JSON.stringify({
        data: req.url.endsWith("/validate")
          ? { valid: true, errors: [], warnings: [], contentHash: "hash" }
          : {
              sessionId: "s1",
              reviewId: "r1",
              status: "saved",
              actualUseCount: 1,
              recommendationCount: 0,
            },
      }),
    );
  });
  assert.equal((await run(["review", "validate", file])).code, 0);
  assert.equal(requests.length, 1);
  const result = await run(["review", "save", file]);
  assert.equal(result.code, 0);
  assert.equal(result.json().status, "saved");
  assert.deepEqual(
    requests.map((r) => r.url),
    [
      "/api/speaking/reviews/validate",
      "/api/speaking/reviews/validate",
      "/api/speaking/reviews",
    ],
  );
  requests.forEach((req) => assert.deepEqual(req.body, draft));
  assert.deepEqual(JSON.parse(await fs.readFile(file)), draft);
});
test("解析、驗證、401、409 與 redirect 分別失敗且不輸出原文", async (t) => {
  let status = 401;
  const { run, file } = await setup(t, (_, res) => {
    res.statusCode = status;
    if (status === 302) res.setHeader("location", "http://example.test/stolen");
    res.end(
      JSON.stringify({
        error: { code: "SERVER_ERROR", message: "不得回顯此原始對話" },
      }),
    );
  });
  let result = await run(["review", "validate", file]);
  assert.equal(result.code, 3);
  assert.doesNotMatch(result.stdout, /不得回顯/);
  status = 409;
  result = await run(["review", "save", file]);
  assert.equal(result.code, 5);
  status = 302;
  result = await run(["practice", "context"]);
  assert.equal(result.code, 6);
  await fs.writeFile(file, "{ invalid");
  result = await run(["review", "validate", file]);
  assert.equal(result.code, 2);
});
test("login 交換 cookie、檔案 0600、不印 token，取消不覆蓋原登入", async (t) => {
  let hash,
    denied = false;
  const { run, origin, credential } = await setup(t, (req, res, body) => {
    if (req.url.endsWith("/authorizations")) {
      hash = body.verifierHash;
      res.end(
        JSON.stringify({
          data: {
            authorizationId: "grant-1",
            verificationUrl:
              "http://127.0.0.1:4280/cli-login?authorization=grant-1",
            pairingCode: "ABC123DEF0",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            pollIntervalMs: 1,
          },
        }),
      );
    } else {
      assert.equal(
        createHash("sha256").update(body.verifier).digest("hex"),
        hash,
      );
      if (!denied)
        res.setHeader(
          "set-cookie",
          "session=new-private-token; HttpOnly; Path=/; SameSite=Strict",
        );
      res.end(
        JSON.stringify({
          data: {
            status: denied ? "denied" : "approved",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            userId: "user-1",
            email: "test@example.test",
          },
        }),
      );
    }
  });
  const result = await run(["login", "--no-browser"]);
  assert.equal(result.code, 0);
  assert.equal(result.json().apiOrigin, origin);
  assert.doesNotMatch(result.stdout + result.stderr, /new-private-token/);
  assert.equal((await fs.stat(credential)).mode & 0o777, 0o600);
  assert.equal(
    JSON.parse(await fs.readFile(credential)).token,
    "new-private-token",
  );
  denied = true;
  assert.equal((await run(["login", "--no-browser"])).code, 3);
  assert.equal(
    JSON.parse(await fs.readFile(credential)).token,
    "new-private-token",
  );
});
