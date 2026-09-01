import { test, expect, type Page } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function stubHistory(page: Page) {
  const now = "2026-08-30T08:00:00.000Z";
  const sessions = Array.from({ length: 30 }, (_, index) => ({
    id: `scroll-${index}`,
    clientSessionId: `scroll-${index}`,
    source: "LOCAL",
    reviewed: true,
    title: `口說練習 ${index}`,
    summary: "練習回顧",
    startedAt: now,
    endedAt: now,
    updatedAt: now,
    messageCount: 1,
    revision: 1,
  }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const respond = (json: unknown) => route.fulfill({ json });
    if (path === "/api/auth/me")
      return respond({
        data: { id: "fixture", email: "fixture@example.test", name: "測試" },
      });
    if (path === "/api/speaking/sessions")
      return respond({
        data: sessions,
        meta: { hasMore: false, nextCursor: null },
      });
    if (path.endsWith("/messages"))
      return respond({
        data: [
          {
            id: "original",
            role: "user",
            text: "I watch shows at normal speed.",
            createdAt: now,
            transcriptStatus: "available",
          },
        ],
        meta: { hasMore: false, nextCursor: null },
      });
    const session = sessions.find(
      (item) => path === `/api/speaking/sessions/${item.id}`,
    );
    if (session)
      return respond({
        data: {
          session,
          review: null,
          legacySummaries: [
            {
              id: "summary",
              ordinal: 1,
              createdAt: now,
              text: "## 這次實際使用的單字\n\n| 單字 | 意思 | 例句 |\n| --- | --- | --- |\n| normal | 正常的 | I watch shows at normal speed. |\n| watch | 觀看 | I watch a show. |",
            },
          ],
        },
      });
    return respond({ data: [], meta: { hasMore: false } });
  });
  await page.goto("/speaking/history");
  await expect(page.getByTestId("speaking-history-item")).toHaveCount(30);
}

test("返回歷史列表保留原本捲動位置，重複進出仍正確", async ({ page }) => {
  await stubHistory(page);
  for (const index of [18, 24]) {
    const item = page.getByTestId("speaking-history-item").nth(index);
    await item.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(500);
    await item.click();
    await expect(page.getByTestId("speaking-history-continue")).toBeEnabled();
    if (index === 24) {
      await page.getByTestId("speaking-history-continue").click();
      await expect(
        page.getByTestId("speaking-review-discussion"),
      ).toBeVisible();
      await page.getByRole("button", { name: /返回/ }).click();
      await expect(page.getByTestId("speaking-history-continue")).toBeEnabled();
    }
    await page.getByRole("button", { name: /返回/ }).click();
    await expect(page.getByTestId("speaking-history-item")).toHaveCount(30);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  }
});

test("手機摘要表格允許手指左右滑動", async ({ page }) => {
  await stubHistory(page);
  await page.getByTestId("speaking-history-item").first().click();
  await expect(page.getByTestId("speaking-history-continue")).toBeEnabled();
  await page.getByTestId("speaking-history-continue").click();
  await page.getByTestId("speaking-summary-toggle-0").click();
  const table = page.getByRole("region", { name: "單字表格，可左右捲動" });
  await table.scrollIntoViewIfNeeded();
  expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  const box = (await table.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width - 30;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 6; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - step * 30, y }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => table.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(50);
  await cdp.detach();
});

test("允許橫向捲動後，長按拖曳選字仍鎖住頁面與表格捲動", async ({ page }) => {
  await stubHistory(page);
  await page.getByTestId("speaking-history-item").first().click();
  await expect(page.getByTestId("speaking-history-continue")).toBeEnabled();
  await page.getByTestId("speaking-history-continue").click();
  await page.getByTestId("speaking-summary-toggle-0").click();
  const table = page.getByRole("region", { name: "單字表格，可左右捲動" });
  await table.scrollIntoViewIfNeeded();
  const word = table.getByRole("cell", { name: "normal", exact: true });
  const box = (await word.boundingBox())!;
  const x = box.x + 30;
  const y = box.y + box.height / 2;
  const before = await page.evaluate(() => window.scrollY);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  // 等長按啟動後才拖動，與一般快速滑動區分。
  await expect(
    page.getByTestId("speaking-discussion-selection-mark-action"),
  ).toBeVisible();
  for (let step = 1; step <= 6; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + step * 12, y: y - step * 8 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByTestId("speaking-discussion-selection-mark-action"),
  ).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expect(await table.evaluate((el) => el.scrollLeft)).toBe(0);
  await cdp.detach();
});
