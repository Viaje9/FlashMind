import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

interface TestAccount {
  email: string;
  password: string;
}

interface TestAccountsFile {
  testUser?: TestAccount;
  speakingCliTestUser?: TestAccount;
}

test.describe("Speaking 選取翻譯 tooltip", () => {
  test("選取 assistant 文字後可顯示翻譯 tooltip", async ({ page }) => {
    const account = await readTestAccount();

    let translateCalls = 0;
    await page.route("**/speaking/translate", async (route) => {
      translateCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            translatedText: "這是測試翻譯結果。",
          },
        }),
      });
    });

    await login(page, account);

    const conversationId = await seedAssistantConversation(page, {
      conversationId: `e2e-selection-translate-${Date.now()}`,
      messageId: `assistant-${Date.now()}`,
      text: "I am practicing speaking English today.",
    });

    await page.goto(`/speaking?conversationId=${conversationId}`);

    const transcript = page
      .getByTestId("speaking-assistant-transcript")
      .first();
    await expect(transcript).toBeVisible();

    await transcript.selectText();

    const actionButton = page.getByTestId(
      "speaking-selection-translate-action",
    );
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await expect(
      page.getByTestId("speaking-selection-translate-tooltip"),
    ).toBeVisible();
    await expect(
      page.getByTestId("speaking-selection-translate-result"),
    ).toHaveText("這是測試翻譯結果。");
    expect(translateCalls).toBeGreaterThanOrEqual(1);
  });
});

async function login(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(account.email);
  await page.getByTestId("login-password").fill(account.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/(decks|home|speaking)/, { timeout: 15000 });
}

async function readTestAccount(): Promise<TestAccount> {
  const accountPath = path.resolve(__dirname, "../../.auth/test-accounts.json");
  const raw = await fs.readFile(accountPath, "utf-8");
  const parsed = JSON.parse(raw) as TestAccountsFile;

  const account =
    process.env.SPEAKING_ISOLATED_E2E === "true"
      ? parsed.speakingCliTestUser
      : parsed.testUser;
  if (!account?.email || !account?.password) {
    throw new Error("e2e/.auth/test-accounts.json 缺少 testUser 帳號資料");
  }

  return account;
}

async function seedAssistantConversation(
  page: Page,
  input: { conversationId: string; messageId: string; text: string },
): Promise<string> {
  const currentUser = await page.request.get("/api/auth/me");
  expect(currentUser.status()).toBe(200);
  const expectedUserId = (await currentUser.json()).data.id;
  const now = new Date().toISOString();
  const created = await page.request.post("/api/speaking/sessions", {
    data: {
      clientSessionId: input.conversationId,
      title: "E2E Selection Translate",
      startedAt: now,
      expectedUserId,
    },
  });
  expect(created.status()).toBe(201);
  const session = (await created.json()).data;
  const appended = await page.request.post(
    `/api/speaking/sessions/${session.id}/messages`,
    {
      data: {
        expectedUserId,
        revision: session.revision,
        messages: [
          {
            id: input.messageId,
            role: "assistant",
            text: input.text,
            createdAt: now,
          },
        ],
      },
    },
  );
  expect(appended.status()).toBe(200);
  return session.id;
}
