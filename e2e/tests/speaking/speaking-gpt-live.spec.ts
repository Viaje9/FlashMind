import { test, expect } from "@playwright/test";

test("GPT Live 選項保存、持續收音、尾端逐字稿與重新開啟", async ({ page }) => {
  const events: Array<{ type: string; interactionMode?: string }> = [];
  const remoteTexts: string[] = [];
  let remoteSession: Record<string, unknown> = {};
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          data: { id: "live-test", email: "live@example.test", name: "測試" },
        },
      });
    if (path === "/api/speaking/practice-context")
      return route.fulfill({
        json: {
          data: {
            userId: "live-test",
            vocabularyCount: 0,
            targetVocabulary: [],
            lastPractice: null,
            nextPractice: null,
          },
        },
      });
    if (
      path === "/api/speaking/sessions" &&
      route.request().method() === "POST"
    ) {
      const body = route.request().postDataJSON();
      remoteSession = {
        ...body,
        id: "live-remote",
        revision: 1,
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        source: "APP",
        reviewed: false,
      };
      return route.fulfill({ json: { data: remoteSession } });
    }
    if (path.endsWith("/messages") && route.request().method() === "POST") {
      remoteTexts.push(
        ...route
          .request()
          .postDataJSON()
          .messages.map((message: { text: string }) => message.text),
      );
      return route.fulfill({ json: { data: { revision: 2 } } });
    }
    return route.fulfill({ json: { data: [], meta: { hasMore: false } } });
  });
  await page.routeWebSocket("**/speaking/realtime", (socket) => {
    socket.onMessage((raw) => {
      const event = JSON.parse(String(raw));
      events.push(event);
      if (event.type === "session.configure")
        socket.send(JSON.stringify({ type: "flashmind.session.ready" }));
      if (
        event.type === "input_audio_buffer.append" &&
        !events.some((e) => e.type === "test.sent")
      ) {
        events.push({ type: "test.sent" });
        socket.send(
          JSON.stringify({
            type: "session.input_transcript.delta",
            event_id: "u1",
            delta: "Hello Live.",
            start_ms: 100,
            end_ms: 700,
          }),
        );
        socket.send(
          JSON.stringify({
            type: "session.output_transcript.delta",
            event_id: "a1",
            delta: "Hi there.",
            start_ms: 800,
            end_ms: 1400,
          }),
        );
        socket.send(
          JSON.stringify({
            type: "session.output_audio.delta",
            delta: Buffer.alloc(4800).toString("base64"),
          }),
        );
      }
      if (event.type === "session.close") {
        socket.send(
          JSON.stringify({
            type: "session.output_transcript.delta",
            event_id: "a2",
            delta: " Goodbye.",
            start_ms: 1500,
            end_ms: 1900,
          }),
        );
        socket.send(JSON.stringify({ type: "session.closed" }));
        socket.close();
      }
    });
  });
  await test.step("選擇第四種模式並確認保存", async () => {
    await page.goto("/settings/speaking");
    await page.getByTestId("speaking-settings-mode-gpt-live").click();
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem("flashmind.settings.speaking") || "{}",
            ).interactionMode,
        ),
      )
      .toBe("GPT_LIVE");
  });
  await test.step("開始持續對話並顯示雙方逐字稿", async () => {
    await page.goto("/speaking");
    await page.getByTestId("speaking-mic-main").click();
    await expect(
      page.getByTestId("speaking-full-duplex-ai-mute"),
    ).toBeVisible();
    await expect
      .poll(() => events.some((e) => e.type === "input_audio_buffer.append"))
      .toBe(true);
    expect(
      events.find((e) => e.type === "session.configure")?.interactionMode,
    ).toBe("GPT_LIVE");
    await expect(page.getByText("Hi there.", { exact: true })).toBeVisible();
    expect(remoteTexts).toEqual([]);
  });
  await test.step("停止後保存最後片段，重整仍保留完整文字", async () => {
    await page.getByTestId("speaking-mic-main").click();
    await expect(
      page.getByText("Hi there. Goodbye.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => events.filter((e) => e.type === "session.close").length)
      .toBe(1);
    await expect
      .poll(() => String(remoteSession["id"] ?? ""))
      .toBe("live-remote");
    await page.screenshot({
      path: "test-results/gpt-live.png",
      fullPage: true,
    });
    // 本機 conversationId 由頁面維護；檢查 IndexedDB 確實保存完整尾端文字。
    const texts = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      const results: string[] = [];
      for (const entry of databases) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(entry.name!);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        for (const name of Array.from(db.objectStoreNames)) {
          const values = await new Promise<Array<{ text?: string }>>(
            (resolve, reject) => {
              const request = db.transaction(name).objectStore(name).getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            },
          );
          results.push(...values.map((v) => v.text || ""));
        }
        db.close();
      }
      return results;
    });
    expect(texts).toContain("Hi there. Goodbye.");
    await expect.poll(() => remoteTexts).toContain("Hi there. Goodbye.");
    await page.goto(
      `/speaking?conversationId=${remoteSession["clientSessionId"]}`,
    );
    await expect(
      page.getByText("Hi there. Goodbye.", { exact: true }),
    ).toBeVisible();
  });
});
