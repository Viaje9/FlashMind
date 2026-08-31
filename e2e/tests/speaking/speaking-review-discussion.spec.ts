import { test, expect } from "@playwright/test";

// 隔離的 API fixture：不登入真實帳號、不呼叫 AI、不寫入使用者資料。
for (const source of ["LOCAL", "APP"]) {
  test(`${source} 已整理對話的後續討論不儲存，離開與重整皆清除`, async ({
    page,
  }) => {
    const now = "2026-08-30T08:00:00.000Z";
    const session = {
      id: "review-source",
      clientSessionId: "original",
      source,
      reviewed: true,
      title: "看影集練習",
      summary: "注意過去式",
      startedAt: now,
      endedAt: now,
      updatedAt: now,
      messageCount: 1,
      revision: 1,
    };
    const chatRequests: Array<{
      message: string;
      history: Array<{ content: string }>;
    }> = [];
    const writes: string[] = [];
    const speechRequests: string[] = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() !== "GET")
        writes.push(`${request.method()} ${pathname}`);
      const respond = (json: unknown) => route.fulfill({ json });
      if (pathname === "/api/tts/synthesize") {
        speechRequests.push(request.postDataJSON().text);
        // 可解碼的靜音 WAV，驗證真實播放器而不呼叫 Azure 或 Google。
        const dataSize = 16000 * 2 * 8;
        const audio = Buffer.alloc(44 + dataSize);
        audio.write("RIFF", 0);
        audio.writeUInt32LE(36 + dataSize, 4);
        audio.write("WAVEfmt ", 8);
        audio.writeUInt32LE(16, 16);
        audio.writeUInt16LE(1, 20);
        audio.writeUInt16LE(1, 22);
        audio.writeUInt32LE(16000, 24);
        audio.writeUInt32LE(32000, 28);
        audio.writeUInt16LE(2, 32);
        audio.writeUInt16LE(16, 34);
        audio.write("data", 36);
        audio.writeUInt32LE(dataSize, 40);
        return route.fulfill({ contentType: "audio/wav", body: audio });
      }
      if (pathname === "/api/auth/me")
        return respond({
          data: {
            id: "fixture-user",
            email: "fixture@example.test",
            name: "測試",
          },
        });
      if (pathname === "/api/speaking/sessions")
        return respond({
          data: [session],
          meta: { hasMore: false, nextCursor: null },
        });
      if (pathname === "/api/speaking/sessions/review-source")
        return respond({
          data: { session, review: null, legacySummaries: [] },
        });
      if (pathname === "/api/speaking/sessions/review-source/messages")
        return respond({
          data: [
            {
              id: "source-message",
              role: "user",
              text: "I watch yesterday.",
              createdAt: now,
              transcriptStatus: "available",
            },
          ],
          meta: { hasMore: false, nextCursor: null },
        });
      if (pathname === "/api/speaking/chat") {
        chatRequests.push(request.postDataJSON());
        return respond({
          data: {
            reply: "可以改成 I watched a show yesterday.",
            model: "fixture",
            usage: {},
          },
        });
      }
      return respond({ data: [], meta: { hasMore: false } });
    });
    await page.goto("/speaking/history");
    const historyPage = page.getByTestId("speaking-history-page");
    await expect(historyPage).toHaveCSS("padding-bottom", "32px");
    await page.getByTestId("speaking-history-item").click();
    await expect(page.getByTestId("speaking-history-continue")).toBeEnabled();
    const original = await page.locator("main").innerText();
    await expect(page.getByTestId("speaking-history-continue")).toHaveText(
      "討論改進方向",
    );
    await page.getByTestId("speaking-history-continue").click();
    await expect(historyPage).toHaveCSS("padding-bottom", "0px");
    await expect(page.getByTestId("speaking-discussion-notice")).toContainText(
      "後續討論不儲存",
    );
    await expect(page.getByTestId("topic-conversation-hint")).toHaveCount(0);
    const originalText = page
      .getByTestId("speaking-discussion-source")
      .getByText("I watch yesterday.", { exact: true });
    await originalText.scrollIntoViewIfNeeded();
    await originalText.evaluate((element) => {
      const text = document
        .createTreeWalker(element, NodeFilter.SHOW_TEXT)
        .nextNode();
      if (!text) throw new Error("找不到原句文字");
      const range = document.createRange();
      range.setStart(text, 2);
      range.setEnd(text, 7);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    const speech = page.getByTestId(
      "speaking-discussion-selection-speech-action",
    );
    await expect(speech).toBeVisible();
    await speech.click();
    await expect(speech).toHaveAttribute("aria-label", "暫停朗讀");
    expect(speechRequests).toEqual(["watch"]);
    await speech.click();
    await expect(speech).toHaveAttribute("aria-label", "朗讀選取文字");
    await page.getByTestId("topic-conversation-input").fill("請幫我改進這句");
    await page.getByTestId("topic-conversation-send").click();
    await expect(
      page.getByText("可以改成 I watched a show yesterday.", { exact: true }),
    ).toBeVisible();
    await page.getByTestId("topic-conversation-input").fill("為什麼用過去式？");
    await page.getByTestId("topic-conversation-send").click();
    await expect(
      page.getByText("可以改成 I watched a show yesterday.", { exact: true }),
    ).toHaveCount(2);
    expect(chatRequests[0].history.map((m) => m.content).join("")).toContain(
      "I watch yesterday.",
    );
    expect(chatRequests[1].history.map((m) => m.content).join("")).toContain(
      "請幫我改進這句",
    );
    await page.getByTestId("speaking-discussion-back").click();
    await expect(historyPage).toHaveCSS("padding-bottom", "32px");
    expect(await page.locator("main").innerText()).toBe(original);
    await page.getByTestId("speaking-history-continue").click();
    await expect(page.getByText("請幫我改進這句", { exact: true })).toHaveCount(
      0,
    );
    await page.reload();
    await page.getByTestId("speaking-history-item").click();
    await expect.poll(() => page.locator("main").innerText()).toBe(original);
    expect(writes).toEqual([
      "POST /api/tts/synthesize",
      "POST /api/speaking/chat",
      "POST /api/speaking/chat",
    ]);
  });
}
