import { test, expect, devices, type Locator } from "@playwright/test";

// 使用瀏覽器實際文字座標與 caret API；iPhone 系統手勢仍需真機確認。
test.use({
  viewport: devices["iPhone 13"].viewport,
  userAgent: devices["iPhone 13"].userAgent,
  isMobile: true,
  hasTouch: true,
});

async function pointAt(text: Locator, offset: number) {
  return text.evaluate((element, index) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (index < node.length) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        return { x: rect.left + 0.5, y: rect.top + rect.height / 2 };
      }
      index -= node.length;
    }
    throw new Error("文字座標不存在");
  }, offset);
}

async function dispatchPointer(
  target: Locator,
  type: string,
  point: { x: number; y: number },
) {
  await target.dispatchEvent(type, {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
    bubbles: true,
    cancelable: true,
  });
}

for (const role of ["assistant", "user"] as const) {
  test(`${role} 自訂選字跨行調整不改動原文，放大鏡穩定且工具列使用最後範圍`, async ({
    page,
    browserName,
  }, testInfo) => {
    const touchSession =
      browserName === "chromium"
        ? await page.context().newCDPSession(page)
        : null;
    const pointer = async (
      target: Locator,
      type: string,
      point: { x: number; y: number },
    ) => {
      if (!touchSession) return dispatchPointer(target, type, point);
      const eventType = {
        pointerdown: "touchStart",
        pointermove: "touchMove",
        pointerup: "touchEnd",
        pointercancel: "touchCancel",
      }[type] as "touchStart" | "touchMove" | "touchEnd" | "touchCancel";
      await touchSession.send("Input.dispatchTouchEvent", {
        type: eventType,
        touchPoints:
          type === "pointerup" || type === "pointercancel"
            ? []
            : [{ x: point.x, y: point.y, id: 1 }],
      });
    };
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const now = "2026-09-13T05:00:00.000Z";
    const session = {
      id: "custom-selection",
      clientSessionId: "custom-selection",
      source: "APP",
      reviewed: true,
      title: "自訂選字驗證",
      summary: "注意過去式",
      startedAt: now,
      endedAt: now,
      updatedAt: now,
      messageCount: 1,
      revision: 1,
    };
    const sentence =
      "Yesterday I was working on a small project. I wanted to finish it, but I had another idea.";
    const translations: string[] = [];
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
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
        return respond({ data: [session], meta: { hasMore: false } });
      if (pathname === "/api/speaking/sessions/custom-selection")
        return respond({
          data: { session, review: null, legacySummaries: [] },
        });
      if (pathname.endsWith("/custom-selection/messages"))
        return respond({
          data: [
            {
              id: "custom-source",
              role,
              text:
                role === "user"
                  ? sentence
                  : sentence.replace("was working", "**was working**"),
              createdAt: now,
              transcriptStatus: "available",
            },
          ],
          meta: { hasMore: false },
        });
      if (pathname.endsWith("/speaking/translate")) {
        translations.push(route.request().postDataJSON().text);
        return respond({ data: { translatedText: "正在做一個小專案" } });
      }
      return respond({ data: [], meta: { hasMore: false } });
    });
    await test.step("開啟討論，停用來源文字的系統選單", async () => {
      await page.goto("/speaking/history");
      await page.getByTestId("speaking-history-item").click();
      await page.getByTestId("speaking-history-continue").click();
      await expect(page.getByTestId("speaking-review-discussion")).toHaveClass(
        /mobile-selection-enabled/,
      );
    });
    const text = page
      .getByTestId("speaking-discussion-source")
      .locator('[data-speaking-selection-context="review-discussion"]')
      .first();
    const toolbar = page.getByTestId("speaking-discussion-selection-actions");
    const lens = page.getByTestId("speaking-selection-magnifier");
    let point: { x: number; y: number };
    await test.step("長按單字顯示雙端拖桿與固定大小的放大鏡", async () => {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      // 行動模擬器有獨立的 visual viewport；實際捲回頂端才能使用可見文字座標。
      if (touchSession)
        await touchSession.send("Input.synthesizeScrollGesture", {
          x: 200,
          y: 300,
          yDistance: 600,
          speed: 2000,
          gestureSourceType: "touch",
        });
      await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      await expect(text).toHaveCSS("-webkit-user-select", "none");
      expect(
        await text.evaluate(
          (element) =>
            !element.dispatchEvent(
              new Event("contextmenu", { bubbles: true, cancelable: true }),
            ),
        ),
      ).toBe(true);
      point = await pointAt(text, sentence.indexOf("was") + 1);
      expect(
        await text.evaluate(
          (element, point) =>
            element.contains(document.elementFromPoint(point.x, point.y)),
          point,
        ),
      ).toBe(true);
      await pointer(text, "pointerdown", point);
      await expect(lens).toBeVisible();
      await expect(lens).toHaveCSS("width", "184px");
      await expect(
        page.getByTestId("speaking-selection-handle-start"),
      ).toBeVisible();
      await pointer(text, "pointerup", point);
      await expect(lens).toHaveCount(0);
      await expect(toolbar).toBeVisible();
      const selectionBox = (await page
        .locator(".selection-highlight")
        .first()
        .boundingBox())!;
      const toolbarBox = (await toolbar.boundingBox())!;
      expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(
        selectionBox.y - 22,
      );
      expect(
        selectionBox.y - toolbarBox.y - toolbarBox.height,
      ).toBeLessThanOrEqual(32);
      expect(toolbarBox.x).toBeGreaterThanOrEqual(8);
      expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(382);
      await expect(
        page
          .locator("footer")
          .getByTestId("speaking-discussion-selection-actions"),
      ).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath("selection-toolbar.png"),
      });
    });
    await test.step("拖曳終點跨過粗體與換行，原文節點完全不重建", async () => {
      await text.evaluate((element) => {
        const state = window as unknown as {
          sourceMutations: number;
          sourceObserver: MutationObserver;
        };
        state.sourceMutations = 0;
        state.sourceObserver = new MutationObserver(
          (records) => (state.sourceMutations += records.length),
        );
        state.sourceObserver.observe(element, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });
      const handle = page.getByTestId("speaking-selection-handle-end");
      const box = (await handle.boundingBox())!;
      const grab = {
        x: box.x + box.width / 2 + 8,
        y: box.y + box.height / 2 + 8,
      };
      // 刻意抓偏拖桿中心，確認指尖偏移會保留。
      const originalCaret = await pointAt(text, sentence.indexOf("was") + 3);
      await pointer(handle, "pointerdown", grab);
      for (const offset of [18, 24, 30, 35, 41]) {
        const destination = await pointAt(text, offset);
        point = {
          x: destination.x + grab.x - originalCaret.x,
          y: destination.y + grab.y - originalCaret.y,
        };
        await pointer(handle, "pointermove", point);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        await expect(lens).toHaveCSS("width", "184px");
      }
      await page.screenshot({
        path: testInfo.outputPath("custom-selection-drag.png"),
      });
      await pointer(handle, "pointerup", point);
      await expect(lens).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { sourceMutations: number }).sourceMutations,
        ),
      ).toBe(0);
      if (role === "assistant")
        await expect(text.locator("strong")).toHaveText("was working");
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
        "",
      );
      await expect(page.locator(".selection-highlight")).not.toHaveCount(0);
    });
    await test.step("點一次翻譯，使用調整後的跨行範圍", async () => {
      await page
        .getByTestId("speaking-discussion-selection-translate-action")
        .tap();
      await expect(
        page.getByTestId("speaking-discussion-selection-translate-tooltip"),
      ).toContainText("正在做一個小專案");
      expect(translations).toEqual([
        sentence.slice(sentence.indexOf("was"), 41),
      ]);
      await page
        .getByTestId("speaking-discussion-selection-translate-close")
        .tap();
      await expect(toolbar).toHaveCount(0);
      await expect(page.locator(".selection-highlight")).toHaveCount(0);
    });
    await test.step("左右側邊的放大鏡不露出訊息外空白，且只顯示目前行", async () => {
      point = await pointAt(text, sentence.indexOf("was") + 1);
      await pointer(text, "pointerdown", point);
      await expect(lens).toBeVisible();
      await pointer(text, "pointerup", point);
      for (const edge of ["start", "end"] as const) {
        const handle = page.getByTestId("speaking-selection-handle-" + edge);
        const box = (await handle.boundingBox())!;
        const grab = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await pointer(handle, "pointerdown", grab);
        point = { x: edge === "start" ? 2 : 388, y: grab.y };
        await pointer(handle, "pointermove", point);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const windowBox = (await lens.locator(".line-window").boundingBox())!;
        const sourceBox = (await lens.locator(".surface").boundingBox())!;
        expect(sourceBox.x).toBeLessThanOrEqual(windowBox.x + 0.5);
        expect(sourceBox.x + sourceBox.width).toBeGreaterThanOrEqual(
          windowBox.x + windowBox.width - 0.5,
        );
        expect(windowBox.height).toBeLessThanOrEqual(44);
        const lensBox = (await lens.boundingBox())!;
        expect(lensBox.x).toBeGreaterThanOrEqual(8);
        expect(lensBox.x + lensBox.width).toBeLessThanOrEqual(382);
        await page.screenshot({
          path: testInfo.outputPath(`magnifier-${edge}.png`),
        });
        await pointer(handle, "pointerup", point);
      }
    });
    const scrollFrom = async (
      start: { x: number; y: number },
      distance: number,
    ) => {
      if (touchSession) {
        await touchSession.send("Input.synthesizeScrollGesture", {
          x: start.x,
          y: start.y,
          yDistance: -distance,
          speed: 400,
          gestureSourceType: "touch",
        });
      } else {
        await pointer(text, "pointerdown", start);
        await pointer(text, "pointermove", {
          x: start.x,
          y: start.y - distance,
        });
        await pointer(text, "pointercancel", start);
        await page.evaluate(
          (dy) => window.scrollBy({ top: dy, behavior: "instant" }),
          distance,
        );
      }
      await page.evaluate(() => new Promise(requestAnimationFrame));
    };
    await test.step("從反白上捲頁保留選取，反白跟著原文移動；輕點再開工具列", async () => {
      const highlight = page.locator(".selection-highlight").first();
      const before = (await highlight.boundingBox())!;
      await scrollFrom(await pointAt(text, 5), 44);
      await expect(toolbar).toHaveCount(0);
      await expect(highlight).toBeVisible();
      const after = (await highlight.boundingBox())!;
      expect(Math.abs(after.y - before.y)).toBeGreaterThan(10);
      expect(after.width).toBeCloseTo(before.width, 0);
      const sourceY = await text.evaluate((element) => {
        const node = document
          .createTreeWalker(element, NodeFilter.SHOW_TEXT)
          .nextNode()!;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, 1);
        return range.getBoundingClientRect().top;
      });
      expect(after.y).toBeCloseTo(sourceY, 0);
      point = await pointAt(text, 5);
      await pointer(text, "pointerdown", point);
      await pointer(text, "pointerup", point);
      await expect(toolbar).toBeVisible();
      await expect(lens).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath("selection-after-scroll.png"),
      });
    });
    await test.step("從反白外捲頁也保留選取；輕點外面才清除", async () => {
      await scrollFrom(await pointAt(text, sentence.length - 5), -28);
      await expect(toolbar).toHaveCount(0);
      await expect(page.locator(".selection-highlight").first()).toBeVisible();
      point = await pointAt(text, sentence.length - 5);
      await pointer(text, "pointerdown", point);
      await expect(page.locator(".selection-highlight").first()).toBeVisible();
      await pointer(text, "pointerup", point);
      await expect(page.locator(".selection-highlight")).toHaveCount(0);
      await expect(
        page.getByTestId("speaking-selection-handle-start"),
      ).toHaveCount(0);
      await expect(toolbar).toHaveCount(0);
    });
    await test.step("輸入欄仍保留原生編輯", async () => {
      const editor = page.locator("textarea");
      await editor.fill("test edit");
      expect(
        await editor.evaluate((element) =>
          element.dispatchEvent(
            new Event("contextmenu", { bubbles: true, cancelable: true }),
          ),
        ),
      ).toBe(true);
      expect(pageErrors).toEqual([]);
    });
  });
}
