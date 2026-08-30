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
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() !== "GET")
        writes.push(`${request.method()} ${pathname}`);
      const respond = (json: unknown) => route.fulfill({ json });
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
    await page.getByTestId("speaking-history-item").click();
    const original = await page.locator("main").innerText();
    await expect(page.getByTestId("speaking-history-continue")).toHaveText(
      "討論改進方向",
    );
    await page.getByTestId("speaking-history-continue").click();
    await expect(page.getByTestId("speaking-discussion-notice")).toContainText(
      "後續討論不儲存",
    );
    await expect(page.getByTestId("topic-conversation-hint")).toHaveCount(0);
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
    expect(await page.locator("main").innerText()).toBe(original);
    await page.getByTestId("speaking-history-continue").click();
    await expect(page.getByText("請幫我改進這句", { exact: true })).toHaveCount(
      0,
    );
    await page.reload();
    await page.getByTestId("speaking-history-item").click();
    expect(await page.locator("main").innerText()).toBe(original);
    expect(writes).toEqual([
      "POST /api/speaking/chat",
      "POST /api/speaking/chat",
    ]);
  });
}
