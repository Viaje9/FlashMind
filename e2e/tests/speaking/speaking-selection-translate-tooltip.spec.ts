import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

interface TestAccount {
  email: string;
  password: string;
}

interface TestAccountsFile {
  testUser?: TestAccount;
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

    const conversationId = `e2e-selection-translate-${Date.now()}`;
    await seedAssistantConversation(page, {
      conversationId,
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

  if (!parsed.testUser?.email || !parsed.testUser?.password) {
    throw new Error("e2e/.auth/test-accounts.json 缺少 testUser 帳號資料");
  }

  return parsed.testUser;
}

async function seedAssistantConversation(
  page: Page,
  input: { conversationId: string; messageId: string; text: string },
): Promise<void> {
  await page.evaluate(async (payload) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("flashmind-speaking-db", 2);

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("speaking_conversations")) {
          const conversationStore = db.createObjectStore(
            "speaking_conversations",
            {
              keyPath: "id",
            },
          );
          conversationStore.createIndex("byUpdatedAt", "updatedAt", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("speaking_messages")) {
          const messageStore = db.createObjectStore("speaking_messages", {
            keyPath: "id",
          });
          messageStore.createIndex("byConversationId", "conversationId", {
            unique: false,
          });
          messageStore.createIndex("byCreatedAt", "createdAt", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("speaking_audio")) {
          const audioStore = db.createObjectStore("speaking_audio", {
            keyPath: "id",
          });
          audioStore.createIndex("byConversationId", "conversationId", {
            unique: false,
          });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(
          ["speaking_conversations", "speaking_messages"],
          "readwrite",
        );

        const now = new Date().toISOString();
        tx.objectStore("speaking_conversations").put({
          id: payload.conversationId,
          title: "E2E Selection Translate",
          summary: "",
          messageCount: 1,
          createdAt: now,
          updatedAt: now,
          lastMessageText: payload.text,
        });

        tx.objectStore("speaking_messages").put({
          id: payload.messageId,
          conversationId: payload.conversationId,
          role: "assistant",
          text: payload.text,
          createdAt: now,
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      };
    });
  }, input);
}
