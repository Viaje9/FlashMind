import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import http from "node:http";
import { createRequire } from "node:module";
const root = path.resolve(__dirname, "../..");
const apiOrigin = "http://localhost:4381";
interface Account {
  userId: string;
  email: string;
  password: string;
}
async function account(name = "speakingCliTestUser"): Promise<Account> {
  return JSON.parse(
    await fs.readFile(path.join(root, ".auth/test-accounts.json"), "utf8"),
  )[name];
}
async function login(page: Page, name?: string) {
  const user = await account(name);
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/(home|decks|speaking)/);
  return user;
}
async function checkAccessibility(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const resolve = createRequire(
    path.join(
      root,
      "../apps/web/node_modules/@storybook/addon-a11y/package.json",
    ),
  );
  await page.addScriptTag({ path: resolve.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run(options: unknown): Promise<{
            violations: Array<{
              id: string;
              nodes: Array<{ target: string[]; failureSummary?: string }>;
            }>;
          }>;
        };
      }
    ).axe;
    return (
      await axe.run({
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => ({
        target: node.target,
        reason: node.failureSummary,
      })),
    }));
  });
  expect(violations).toEqual([]);
}
async function practiceContext(page: Page) {
  const response = await page.request.get("/api/speaking/practice-context");
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}
function cli(args: string[], directory: string, origin = apiOrigin) {
  const child = spawn(
    process.execPath,
    [path.join(root, "../apps/cli/bin/flashmind.cjs"), ...args],
    {
      cwd: os.tmpdir(),
      env: {
        ...process.env,
        FLASHMIND_API_URL: origin,
        FLASHMIND_CONFIG_DIR: directory,
      },
    },
  );
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (value) => {
    stdout += value;
  });
  child.stderr.on("data", (value) => {
    stderr += value;
  });
  const done = new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) =>
    child.on("exit", (code) => resolve({ code, stdout, stderr })),
  );
  return { child, stderr: () => stderr, done };
}
async function installSpeechMock(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem(
      "flashmind.settings.speaking",
      JSON.stringify({
        interactionMode: "TURN_BASED",
        autoPlayVoice: false,
        autoTranslate: false,
        showTranscript: true,
      }),
    );
  });
  await context.routeWebSocket("**/api/speaking/realtime", (socket) => {
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.type === "session.configure")
        socket.send(JSON.stringify({ type: "flashmind.session.ready" }));
      if (message.type === "input_audio_buffer.commit") {
        socket.send(
          JSON.stringify({
            type: "conversation.item.input_audio_transcription.completed",
            transcript: "I walk in the park on weekends.",
          }),
        );
        socket.send(
          JSON.stringify({
            type: "response.output_audio_transcript.done",
            transcript: "Who do you usually go with?",
          }),
        );
        socket.send(
          JSON.stringify({
            type: "response.output_audio.delta",
            delta: Buffer.alloc(4800).toString("base64"),
          }),
        );
        socket.send(
          JSON.stringify({
            type: "response.done",
            response: { status: "completed", usage: { total_tokens: 0 } },
          }),
        );
      }
    });
  });
}
async function recordTurn(page: Page) {
  const mic = page.getByTestId("speaking-mic-main");
  await expect(mic).toBeEnabled();
  await mic.click();
  await expect(mic).toHaveAttribute("aria-label", "停止並送出錄音");
  // 讓假的麥克風產生一小段可解碼 WAV。
  await page.waitForTimeout(700);
  await mic.click();
  await expect(
    page.getByTestId("speaking-assistant-transcript").last(),
  ).toContainText("Who do you usually go with?");
}

test("CLI 瀏覽器授權 → 完整 context → 唯讀驗證 → 並行保存 → App 本機來源回顧", async ({
  page,
  browser,
}, testInfo) => {
  const user = await login(page);
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "flashmind-e2e-cli-"),
  );
  const pending = cli(["login", "--no-browser"], directory);
  try {
    await expect
      .poll(() => pending.stderr())
      .toContain("/cli-login?authorization=");
    const verificationUrl = pending
      .stderr()
      .match(/http:\/\/localhost:4380\/cli-login\?authorization=\S+/)![0];
    const pairingCode = pending.stderr().match(/配對碼 ([A-Z0-9]+)/)![1];
    await page.goto(verificationUrl);
    await expect(page.getByTestId("cli-login-account")).toHaveText(user.email);
    await page.getByTestId("cli-login-code").fill(pairingCode);
    await checkAccessibility(page);
    await page.getByTestId("cli-login-approve").click();
    await expect(page.getByTestId("cli-login-result")).toContainText("已授權");
    const loggedIn = await pending.done;
    expect(loggedIn.code).toBe(0);
    expect(loggedIn.stdout).not.toContain("token");
    const contextResult = await cli(["practice", "context"], directory).done;
    expect(contextResult.code).toBe(0);
    const context = JSON.parse(contextResult.stdout);
    expect(context.vocabularyCount).toBe(4);
    expect(
      new Set(context.targetVocabulary.map((w: { status: string }) => w.status))
        .size,
    ).toBe(4);
    const draft = JSON.parse(
      await fs.readFile(
        path.join(root, "../packages/shared/test/review.fixture.json"),
        "utf8",
      ),
    );
    draft.target = { apiOrigin, userId: user.userId };
    draft.contextVersion = context.vocabularyVersion;
    draft.practice.sourceRef.sessionKey = randomUUID();
    draft.practice.title = "CLI E2E 週末散步";
    const word = context.targetVocabulary.find(
      (word: { term: string }) => word.term === "walk",
    );
    draft.result.actualUses[0].targetVocabularyId = word.id;
    draft.result.deckCandidates = [word.id];
    const file = path.join(directory, "review.json");
    await fs.writeFile(file, JSON.stringify(draft));
    const validated = await cli(["review", "validate", file], directory).done;
    expect(validated.code).toBe(0);
    expect(
      (await (await page.request.get("/api/speaking/sessions")).json()).data,
    ).toHaveLength(0);
    expect(
      (await practiceContext(page)).targetVocabulary.find(
        (w: { id: string }) => w.id === word.id,
      ).useCount,
    ).toBe(0);
    const saved = await Promise.all([
      cli(["review", "save", file], directory).done,
      cli(["review", "save", file], directory).done,
    ]);
    saved.forEach((result) => expect(result.code, result.stdout).toBe(0));
    expect(
      saved.map((result) => JSON.parse(result.stdout).status).sort(),
    ).toEqual(["alreadySaved", "saved"]);
    const sessionId = JSON.parse(saved[0].stdout).sessionId;
    await page.goto("/speaking/history");
    await page
      .getByTestId("speaking-history-item")
      .filter({ hasText: draft.practice.title })
      .click();
    await expect(
      page.getByTestId("speaking-history-detail-source"),
    ).toContainText("本機");
    await expect(
      page.getByText(draft.practice.messages[1].text, { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("speaking-history-candidates")).toContainText(
      "walk",
    );
    await checkAccessibility(page);
    await page.screenshot({
      path: testInfo.outputPath("local-history.png"),
      fullPage: true,
    });
    const stranger = await browser.newContext({
      baseURL: "http://localhost:4380",
    });
    const other = await stranger.newPage();
    await login(other, "speakingCliOtherUser");
    expect(
      (await other.request.get(`/api/speaking/sessions/${sessionId}`)).status(),
    ).toBe(404);
    await stranger.close();
    expect(
      (await practiceContext(page)).targetVocabulary.find(
        (w: { id: string }) => w.id === word.id,
      ).useCount,
    ).toBe(1);
    const savedDraft = JSON.stringify(draft);
    draft.result.review = "修改已保存內容";
    await fs.writeFile(file, JSON.stringify(draft));
    expect((await cli(["review", "save", file], directory).done).code).toBe(5);
    const unauthorized = await browser.newContext({
      baseURL: "http://localhost:4380",
    });
    expect(
      (await unauthorized.request.get("/api/speaking/sessions")).status(),
    ).toBe(401);
    const denied = await account("speakingCliDeniedUser");
    await unauthorized.request.post("/api/auth/login", {
      data: { email: denied.email, password: denied.password },
    });
    expect(
      (await unauthorized.request.get("/api/speaking/sessions")).status(),
    ).toBe(403);
    await unauthorized.close();
    expect(
      (
        await page.request.post("/api/speaking/reviews/validate", {
          data: " ".repeat(2 * 1024 * 1024 + 1),
          headers: { "content-type": "application/json" },
        })
      ).status(),
    ).toBe(413);
    await page.goto("/speaking/history");
    await page
      .getByTestId("speaking-history-item")
      .filter({ hasText: draft.practice.title })
      .locator("..")
      .getByTestId("speaking-history-delete")
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await checkAccessibility(page);
    await page.getByTestId("speaking-history-delete-confirm").click();
    await expect(
      page
        .getByTestId("speaking-history-item")
        .filter({ hasText: draft.practice.title }),
    ).toHaveCount(0);
    await fs.writeFile(file, savedDraft);
    expect((await cli(["review", "save", file], directory).done).code).toBe(5);
    expect(
      (await practiceContext(page)).targetVocabulary.find(
        (w: { id: string }) => w.id === word.id,
      ).useCount,
    ).toBe(1);
  } finally {
    pending.child.kill("SIGTERM");
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("App 完成逐字稿同步 → 保存失敗不重產 Summary → 另一瀏覽器回顧 → 延續新場次", async ({
  page,
  context,
  browser,
}, testInfo) => {
  await installSpeechMock(context);
  await login(page);
  const initialContext = await practiceContext(page),
    word = initialContext.targetVocabulary.find(
      (word: { term: string }) => word.term === "walk",
    );
  const title = `App E2E ${randomUUID().slice(0, 6)}`;
  let summaries = 0,
    saveAttempts = 0;
  await page.route("**/api/speaking/summarize", async (route) => {
    summaries++;
    const history = route.request().postDataJSON().history;
    const userMessage = history.find(
      (message: { role: string }) => message.role === "user",
    );
    await route.fulfill({
      json: {
        data: {
          title,
          summary: userMessage.text,
          review: "表達清楚。",
          actualUses: [
            {
              targetVocabularyId: word.id,
              term: "walk",
              zhMeaning: "散步",
              expressionContext: "描述散步習慣",
              naturalSentence: userMessage.text,
              evidence: [
                { messageId: userMessage.id, quote: userMessage.text },
              ],
            },
          ],
          recommendations: [],
          nextPractice: {
            topic: "Weekend routines",
            speakingGoal: "Describe a weekend.",
            guidingQuestions: [],
            recallTargets: ["walk"],
          },
          usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
        },
      },
    });
  });
  await page.route("**/api/speaking/reviews", (route) =>
    ++saveAttempts === 1 ? route.abort("failed") : route.continue(),
  );
  await page.goto("/speaking");
  await recordTurn(page);
  await expect
    .poll(
      async () =>
        (
          await (await page.request.get("/api/speaking/sessions")).json()
        ).data.filter(
          (row: { source: string; reviewed: boolean; messageCount: number }) =>
            row.source === "APP" && !row.reviewed && row.messageCount === 2,
        ).length,
    )
    .toBe(1);
  await page.getByTestId("speaking-summarize").click();
  await expect(page.getByText(/Summary 尚未完成保存/)).toBeVisible();
  expect(summaries).toBe(1);
  await page.getByTestId("speaking-summarize").click();
  await expect(page.getByTestId("speaking-summary-card")).toBeVisible();
  expect(summaries).toBe(1);
  expect(
    (await practiceContext(page)).targetVocabulary.find(
      (w: { id: string }) => w.id === word.id,
    ).useCount,
  ).toBe(word.useCount + 1);
  // 舊頁面只呼叫 Summary、不傳穩定 ID；分析端本身仍不可計次。
  const oldSummary = await page.request.post("/api/speaking/summarize", {
    data: {
      history: [
        { role: "user", text: "I walk in the park on weekends." },
        { role: "assistant", text: "Who with?" },
      ],
    },
  });
  expect(oldSummary.status()).toBe(200);
  expect((await oldSummary.json()).data.actualUses).toHaveLength(1);
  expect(
    (await practiceContext(page)).targetVocabulary.find(
      (w: { id: string }) => w.id === word.id,
    ).useCount,
  ).toBe(word.useCount + 1);

  await page.goto("/speaking/history");
  await page
    .getByTestId("speaking-history-item")
    .filter({ hasText: title })
    .click();
  await expect(
    page.getByTestId("speaking-history-play-audio").first(),
  ).toBeVisible();
  await page.getByTestId("speaking-history-play-audio").first().click();
  const secondContext = await browser.newContext({
    baseURL: "http://localhost:4380",
  });
  const secondPage = await secondContext.newPage();
  await login(secondPage);
  await secondPage.goto("/speaking/history");
  await secondPage
    .getByTestId("speaking-history-item")
    .filter({ hasText: title })
    .click();
  await expect(
    secondPage.getByTestId("speaking-history-audio-unavailable").first(),
  ).toBeVisible();
  await expect(
    secondPage.getByText("Who do you usually go with?", { exact: true }),
  ).toBeVisible();
  await secondPage.screenshot({
    path: testInfo.outputPath("app-history-other-browser.png"),
    fullPage: true,
  });
  await secondContext.close();
  await page.getByTestId("speaking-history-continue").click();
  await expect(page.getByTestId("speaking-summary-card")).toHaveCount(0);
  await recordTurn(page);
  await page.getByTestId("speaking-summarize").click();
  await expect(page.getByTestId("speaking-summary-card")).toBeVisible();
  expect(
    (await practiceContext(page)).targetVocabulary.find(
      (w: { id: string }) => w.id === word.id,
    ).useCount,
  ).toBe(word.useCount + 2);
});

async function seedLegacy(page: Page, id: string) {
  await page.evaluate(
    async ({ id }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("flashmind-speaking-db", 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const now = "2026-08-29T01:00:00.000Z";
      const tx = db.transaction(
        ["speaking_conversations", "speaking_messages", "speaking_audio"],
        "readwrite",
      );
      tx.objectStore("speaking_conversations").put({
        id,
        title: "舊裝置散步紀錄",
        summary: "Old summary two.",
        messageCount: 4,
        createdAt: now,
        updatedAt: now,
      });
      const messages = [
        {
          id: id + "-user",
          role: "user",
          text: "",
          audioBlobKey: id + "-audio",
        },
        {
          id: id + "-assistant",
          role: "assistant",
          text: "Where do you walk?",
          translatedText: "你去哪裡散步？",
        },
        { id: id + "-s1", role: "summary", text: "Old summary one." },
        { id: id + "-s2", role: "summary", text: "Old summary two." },
      ];
      for (const message of messages)
        tx.objectStore("speaking_messages").put({
          ...message,
          conversationId: id,
          createdAt: now,
        });
      const bytes = new Uint8Array(48);
      const view = new DataView(bytes.buffer);
      const write = (position: number, text: string) =>
        [...text].forEach(
          (char, index) => (bytes[position + index] = char.charCodeAt(0)),
        );
      write(0, "RIFF");
      view.setUint32(4, 40, true);
      write(8, "WAVE");
      write(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 24000, true);
      view.setUint32(28, 48000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      write(36, "data");
      view.setUint32(40, 4, true);
      const blob = new Blob([bytes], { type: "audio/wav" });
      tx.objectStore("speaking_audio").put({
        id: id + "-audio",
        conversationId: id,
        messageId: id + "-user",
        blob,
        size: blob.size,
        mimeType: blob.type,
        createdAt: now,
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { id },
  );
}

test("舊 IndexedDB 搬移須確認帳號，回應中斷重試不重複，保留多份摘要與原音", async ({
  page,
  browser,
}, testInfo) => {
  await login(page);
  const before = await practiceContext(page);
  await page.goto("/speaking/history");
  const id = `legacy-${randomUUID()}`;
  await seedLegacy(page, id);
  let attempts = 0;
  await page.route("**/api/speaking/history-migrations", async (route) => {
    if (++attempts === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.reload();
  await expect(page.getByTestId("speaking-migration")).toBeVisible();
  await page.getByTestId("speaking-migration-select").check();
  await expect(page.getByTestId("speaking-migration-start")).toBeDisabled();
  expect(attempts).toBe(0);
  await page.getByTestId("speaking-migration-confirm").check();
  await page.getByTestId("speaking-migration-start").click();
  await expect(page.getByTestId("speaking-migration-result")).toContainText(
    "未完成",
  );
  await page.getByTestId("speaking-migration-start").click();
  await expect(page.getByTestId("speaking-migration-result")).toContainText(
    "之前已搬移",
  );
  await page.reload();
  await expect(page.getByTestId("speaking-migration")).toHaveCount(0);
  await page
    .getByTestId("speaking-history-item")
    .filter({ hasText: "舊裝置散步紀錄" })
    .click();
  await expect(
    page.getByText("Old summary one.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Old summary two.", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByText("你去哪裡散步？", { exact: true })).toBeVisible();
  await expect(page.getByTestId("speaking-history-play-audio")).toBeVisible();
  const after = await practiceContext(page);
  expect(after.targetVocabulary).toEqual(before.targetVocabulary);
  expect(after.nextPractice).toEqual(before.nextPractice);
  await page.screenshot({
    path: testInfo.outputPath("migrated-history.png"),
    fullPage: true,
  });
  const other = await browser.newContext({ baseURL: "http://localhost:4380" });
  const otherPage = await other.newPage();
  await login(otherPage);
  await otherPage.goto("/speaking/history");
  await otherPage
    .getByTestId("speaking-history-item")
    .filter({ hasText: "舊裝置散步紀錄" })
    .click();
  await expect(
    otherPage.getByTestId("speaking-history-audio-unavailable"),
  ).toBeVisible();
  await other.close();
  const backup = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("flashmind-speaking-db", 2);
      request.onsuccess = () => resolve(request.result);
    });
    const get = (store: string, key: string) =>
      new Promise<unknown>((resolve) => {
        const request = db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
      });
    const result = {
      conversation: !!(await get("speaking_conversations", id)),
      audio: !!(await get("speaking_audio", id + "-audio")),
    };
    db.close();
    return result;
  }, id);
  expect(backup).toEqual({ conversation: true, audio: true });
});

test("容量清理只移除舊音訊，待同步文字在帳號切換後仍隔離並可重試", async ({
  page,
  context,
}) => {
  await installSpeechMock(context);
  const user = await login(page);
  await page.goto("/speaking/history");
  const oldId = `capacity-${randomUUID()}`,
    pendingId = `pending-${randomUUID()}`;
  await seedLegacy(page, oldId);
  await page.evaluate(
    async ({ oldId, pendingId, ownerId }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("flashmind-speaking-db", 2);
        request.onsuccess = () => resolve(request.result);
      });
      const tx = db.transaction(
        ["speaking_conversations", "speaking_messages", "speaking_audio"],
        "readwrite",
      );
      const now = "2026-08-28T01:00:00.000Z";
      // 容量依 metadata 加總，用測試 size 達到上限，不占用數百 MB 實體儲存。
      tx.objectStore("speaking_audio").put({
        id: oldId + "-audio",
        conversationId: oldId,
        messageId: oldId + "-user",
        blob: new Blob(["audio"]),
        size: 201 * 1024 * 1024,
        mimeType: "audio/wav",
        createdAt: now,
      });
      tx.objectStore("speaking_conversations").put({
        id: pendingId,
        ownerId,
        source: "APP",
        reviewed: false,
        syncPending: true,
        title: "待同步私有練習",
        createdAt: now,
        updatedAt: now,
        messageCount: 1,
      });
      tx.objectStore("speaking_messages").put({
        id: pendingId + "-user",
        conversationId: pendingId,
        role: "user",
        text: "This pending conversation belongs to my account.",
        audioBlobKey: pendingId + "-audio",
        createdAt: now,
      });
      tx.objectStore("speaking_audio").put({
        id: pendingId + "-audio",
        conversationId: pendingId,
        messageId: pendingId + "-user",
        blob: new Blob(["audio"]),
        size: 201 * 1024 * 1024,
        mimeType: "audio/wav",
        createdAt: now,
      });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { oldId, pendingId, ownerId: user.userId },
  );
  await page.goto("/speaking");
  await recordTurn(page);
  await expect
    .poll(async () =>
      page.evaluate(
        async ({ oldId, pendingId }) => {
          const db = await new Promise<IDBDatabase>((resolve) => {
            const request = indexedDB.open("flashmind-speaking-db", 2);
            request.onsuccess = () => resolve(request.result);
          });
          const get = (store: string, id: string) =>
            new Promise<unknown>((resolve) => {
              const request = db.transaction(store).objectStore(store).get(id);
              request.onsuccess = () => resolve(request.result);
            });
          const values = {
            oldAudio: !!(await get("speaking_audio", oldId + "-audio")),
            oldText: !!(await get("speaking_messages", oldId + "-assistant")),
            pendingText: !!(await get(
              "speaking_messages",
              pendingId + "-user",
            )),
            pendingAudio: !!(await get("speaking_audio", pendingId + "-audio")),
          };
          db.close();
          return values;
        },
        { oldId, pendingId },
      ),
    )
    .toEqual({
      oldAudio: false,
      oldText: true,
      pendingText: true,
      pendingAudio: true,
    });
  await page.goto("/speaking/history");
  const otherAccount = await account("speakingCliOtherUser");
  await page.request.post("/api/auth/login", {
    data: { email: otherAccount.email, password: otherAccount.password },
  });
  // 不重新整理：舊頁面仍顯示第一個帳號，實際 cookie 已切換。
  await page.getByTestId("speaking-history-retry-sync").click();
  expect(
    (await (await page.request.get("/api/speaking/sessions")).json()).data,
  ).toHaveLength(0);
  await page.request.post("/api/auth/logout");
  await login(page, "speakingCliOtherUser");
  await page.goto("/speaking/history");
  await expect(page.getByTestId("speaking-history-retry-sync")).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/speaking/sessions")).json()).data,
  ).toHaveLength(0);
  await page.goto(`/speaking?conversationId=${pendingId}`);
  await expect(
    page.getByText("This pending conversation belongs to my account.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.request.post("/api/auth/logout");
  await login(page);
  await page.goto("/speaking/history");
  await page.getByTestId("speaking-history-retry-sync").click();
  await expect(
    page
      .getByTestId("speaking-history-item")
      .filter({ hasText: "待同步私有練習" }),
  ).toBeVisible();
  await expect(page.getByTestId("speaking-history-retry-sync")).toHaveCount(0);
});

test("CLI 保存已提交但回應逾時，同一草稿重送只取得既有結果", async ({
  page,
}) => {
  const user = await login(page),
    context = await practiceContext(page);
  const origin = "http://localhost:4382",
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "flashmind-timeout-"));
  const word = context.targetVocabulary.find(
    (word: { term: string }) => word.term === "walk",
  );
  let holdFirstSave = true,
    committed = false;
  const proxy = http.createServer((req, res) => {
    const hold =
      req.method === "POST" &&
      req.url === "/api/speaking/reviews" &&
      holdFirstSave;
    if (hold) holdFirstSave = false;
    const upstream = http.request(
      {
        hostname: "localhost",
        port: 4381,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        if (hold) {
          committed = response.statusCode === 201;
          response.resume();
          return;
        }
        res.writeHead(response.statusCode!, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) =>
    proxy.listen(4382, "127.0.0.1", resolve),
  );
  try {
    const session = (await page.context().cookies()).find(
      (cookie) => cookie.name === "session",
    )!;
    await fs.writeFile(
      path.join(
        directory,
        createHash("sha256").update(origin).digest("hex") + ".json",
      ),
      JSON.stringify({
        schemaVersion: 1,
        apiOrigin: origin,
        userId: user.userId,
        email: user.email,
        token: session.value,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
      { mode: 0o600 },
    );
    const draft = JSON.parse(
      await fs.readFile(
        path.join(root, "../packages/shared/test/review.fixture.json"),
        "utf8",
      ),
    );
    draft.target = { apiOrigin: origin, userId: user.userId };
    draft.contextVersion = context.vocabularyVersion;
    draft.practice.sourceRef.sessionKey = randomUUID();
    draft.practice.title = "CLI 逾時重送";
    draft.result.actualUses[0].targetVocabularyId = word.id;
    draft.result.deckCandidates = [word.id];
    const file = path.join(directory, "review.json"),
      original = JSON.stringify(draft);
    await fs.writeFile(file, original);
    const timeout = await cli(["review", "save", file], directory, origin).done;
    expect(timeout.code).toBe(6);
    expect(committed).toBe(true);
    const retry = await cli(["review", "save", file], directory, origin).done;
    expect(retry.code, retry.stdout).toBe(0);
    expect(JSON.parse(retry.stdout).status).toBe("alreadySaved");
    expect(
      (await practiceContext(page)).targetVocabulary.find(
        (w: { id: string }) => w.id === word.id,
      ).useCount,
    ).toBe(word.useCount + 1);
    expect(await fs.readFile(file, "utf8")).toBe(original);
  } finally {
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
