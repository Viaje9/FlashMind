import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

async function setup(page: Page, failSecond = false) {
  const now = "2026-09-01T00:00:00.000Z";
  const words = ["normal", "watch", "pace"].map((term, index) => ({
    id: `word-${index}`,
    term,
    normalizedTerm: term,
    zhMeaning: ["正常的", "觀看", "步調"][index],
    status: "USED",
    useCount: 1,
    recommendationCount: 0,
    naturalSentence: `I use ${term} in this sentence.`,
    createdAt: now,
    updatedAt: now,
  }));
  const requests: Array<{ id: string; body: Record<string, string> }> = [];
  const translations: string[] = [];
  let shouldFail = failSecond;
  await page.addInitScript(() =>
    localStorage.setItem("flashmind.target-vocabulary.filter", "USED"),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          data: { id: "fixture", name: "測試", email: "fixture@example.test" },
        },
      });
    if (path === "/api/target-vocabulary")
      return route.fulfill({ json: { data: words } });
    if (path === "/api/decks")
      return route.fulfill({
        json: {
          data: [{ id: "deck-1", name: "口說單字" }],
          meta: { hasMore: false },
        },
      });
    if (path === "/api/speaking/translate") {
      translations.push(request.postDataJSON().text);
      return route.fulfill({
        json: {
          data: { translatedText: `中文：${request.postDataJSON().text}` },
        },
      });
    }
    const word = words.find(
      (word) => path === `/api/target-vocabulary/${word.id}/add-to-deck`,
    );
    if (word) {
      requests.push({ id: word.id, body: request.postDataJSON() });
      if (word.id === "word-1" && shouldFail) {
        shouldFail = false;
        return route.fulfill({
          status: 500,
          json: { error: { code: "TEST_FAILURE", message: "測試失敗" } },
        });
      }
      return route.fulfill({
        json: {
          data: { ...word, status: "ADDED", addedCardId: `card-${word.id}` },
        },
      });
    }
    return route.fulfill({ json: { data: [], meta: { hasMore: false } } });
  });
  await page.goto("/target-vocabulary");
  await expect(page.getByTestId("target-vocabulary-item-word-0")).toBeVisible();
  return { requests, translations };
}

test("勾選多字、一鍵翻譯後加入同一牌組，留在已使用", async ({ page }) => {
  const { requests, translations } = await setup(page);
  await page.getByTestId("target-vocabulary-select-word-0").check();
  await page.getByTestId("target-vocabulary-select-word-1").check();
  await page.getByTestId("target-vocabulary-batch-add").click();
  await page.getByTestId("target-vocabulary-batch-translate").click();
  await expect(
    page.getByTestId("target-vocabulary-batch-zh-word-1"),
  ).toHaveValue("中文：I use watch in this sentence.");
  await page
    .getByTestId("target-vocabulary-batch-zh-word-0")
    .fill("我用正常速度看影集。");
  await page.getByTestId("target-vocabulary-batch-confirm").click();
  await expect(page.getByTestId("target-vocabulary-notice")).toContainText("2");
  await expect(page.getByTestId("target-vocabulary-filter-used")).toHaveClass(
    /is-active/,
  );
  await expect(page.getByTestId("target-vocabulary-item-word-2")).toBeVisible();
  await expect(page.getByTestId("target-vocabulary-item-word-0")).toHaveCount(
    0,
  );
  expect(requests.map((r) => r.id)).toEqual(["word-0", "word-1"]);
  expect(requests[0].body).toMatchObject({
    deckId: "deck-1",
    zhExample: "我用正常速度看影集。",
    naturalSentence: "I use normal in this sentence.",
  });
  expect(translations).toHaveLength(2);
});

test("批次部分失敗只重試失敗項目，不重複加入已成功單字", async ({ page }) => {
  const { requests } = await setup(page, true);
  await page.getByTestId("target-vocabulary-select-word-0").check();
  await page.getByTestId("target-vocabulary-select-word-1").check();
  await page.getByTestId("target-vocabulary-batch-add").click();
  await page.getByTestId("target-vocabulary-batch-confirm").click();
  await expect(page.getByTestId("target-vocabulary-batch-error")).toContainText(
    "1",
  );
  await page.getByTestId("target-vocabulary-batch-confirm").click();
  await expect(page.getByTestId("target-vocabulary-notice")).toContainText("2");
  expect(requests.map((r) => r.id)).toEqual(["word-0", "word-1", "word-1"]);
  await expect(page.getByTestId("target-vocabulary-filter-used")).toHaveClass(
    /is-active/,
  );
});

test("全選依目前搜尋範圍，取消不寫入牌組，切分頁清除勾選", async ({ page }) => {
  const { requests, translations } = await setup(page);
  await page.getByTestId("target-vocabulary-search").fill("watch");
  await page.getByTestId("target-vocabulary-select-all").check();
  await page.getByTestId("target-vocabulary-batch-add").click();
  await expect(page.getByTestId("target-vocabulary-batch-confirm")).toHaveText(
    "加入 1 個單字",
  );
  await page.getByTestId("target-vocabulary-batch-cancel").click();
  await expect(
    page.getByTestId("target-vocabulary-select-word-1"),
  ).toBeChecked();
  await page.getByTestId("target-vocabulary-filter-practicing").click();
  await page.getByTestId("target-vocabulary-filter-used").click();
  await expect(
    page.getByTestId("target-vocabulary-select-word-1"),
  ).not.toBeChecked();
  expect(requests).toHaveLength(0);
  expect(translations).toHaveLength(0);
});

test("原本單筆加入也不切換到已加入", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByTestId("target-vocabulary-add-to-deck-word-0").click();
  await page.getByTestId("target-vocabulary-add-confirm").click();
  await expect(page.getByTestId("target-vocabulary-notice")).toContainText(
    "normal 已加入牌組",
  );
  await expect(page.getByTestId("target-vocabulary-filter-used")).toHaveClass(
    /is-active/,
  );
  expect(requests).toHaveLength(1);
});

test("部分完成後返回清單，成功的更新狀態，失敗的仍勾選", async ({ page }) => {
  const { requests } = await setup(page, true);
  await page.getByTestId("target-vocabulary-select-word-0").check();
  await page.getByTestId("target-vocabulary-select-word-1").check();
  await page.getByTestId("target-vocabulary-batch-add").click();
  await page.getByTestId("target-vocabulary-batch-confirm").click();
  await expect(page.getByTestId("target-vocabulary-batch-error")).toContainText(
    "1 個未成功",
  );
  await page.getByTestId("target-vocabulary-batch-cancel").click();
  await expect(
    page.getByTestId("target-vocabulary-select-word-1"),
  ).toBeChecked();
  await expect(page.getByTestId("target-vocabulary-item-word-0")).toHaveCount(
    0,
  );
  expect(requests).toHaveLength(2);
});
