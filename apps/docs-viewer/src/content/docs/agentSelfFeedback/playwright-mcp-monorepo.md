---
title: "Playwright MCP 在 Monorepo 中的使用問題"
summary: "記錄 playwright-test MCP 工具在 monorepo 架構下的配置問題與解決方案"
---

# Playwright MCP 在 Monorepo 中的使用問題

| 版本 | 日期 | 作者 | 變更說明 |
|------|------|------|----------|
| 1.0  | 2026-01-17 | Claude | 初版建立 |

---

## 問題描述

在使用 `playwright-test` MCP 工具時，若專案為 monorepo 架構（Playwright 安裝在子目錄如 `e2e/` 而非根目錄），會遇到以下錯誤：

```
Error: Cannot find module '@playwright/test'
Require stack:
- /path/to/project/seed.spec.ts
```

## 根本原因

1. **MCP 預設行為**：`playwright-test` MCP 會在**工作目錄（通常是專案根目錄）**尋找 `seed.spec.ts` 並執行
2. **Monorepo 結構**：`@playwright/test` 安裝在 `e2e/node_modules/`，根目錄的 `node_modules/` 沒有這個套件
3. **模組解析失敗**：根目錄的 `seed.spec.ts` 嘗試 `import { test } from '@playwright/test'` 時找不到模組

## 解決方案

### 方案一：指定 seedFile 參數（推薦）

在呼叫 MCP 工具時，使用 `seedFile` 參數指定 e2e 目錄下的 seed 檔案：

```typescript
// ✅ 正確用法
mcp__playwright-test__generator_setup_page({
  plan: "測試計畫描述",
  seedFile: "e2e/tests/seed.spec.ts"  // 指定 e2e 目錄的 seed
})

mcp__playwright-test__planner_setup_page({
  seedFile: "e2e/tests/seed.spec.ts"
})
```

### 方案二：修改 .mcp.json 使用 e2e 的 Playwright CLI

```json
{
  "mcpServers": {
    "playwright-test": {
      "type": "stdio",
      "command": "node",
      "args": [
        "e2e/node_modules/@playwright/test/cli.js",
        "run-test-mcp-server"
      ]
    }
  }
}
```

### 不推薦的方案

- ❌ 在根目錄安裝 `@playwright/test`（違反 monorepo 原則）
- ❌ 在根目錄的 `seed.spec.ts` 使用相對路徑 import（不穩定）
- ❌ 使用 symlink 連結 node_modules（容易出錯）

## 相關配置

### e2e/tests/seed.spec.ts

```typescript
import { test } from '@playwright/test';

test('seed', async ({ page }) => {
  await page.goto('http://localhost:4280');
});
```

### 專案結構

```
flashmind/
├── .mcp.json              # MCP 配置
├── e2e/                   # Playwright E2E 測試（獨立 workspace）
│   ├── node_modules/
│   │   └── @playwright/   # Playwright 安裝在這裡
│   ├── tests/
│   │   └── seed.spec.ts   # seed 檔案放這裡
│   └── playwright.config.ts
└── node_modules/          # 根目錄沒有 @playwright/test
```

## 學習要點

1. **MCP 工具的工作目錄**：MCP 工具從專案根目錄執行，需注意模組解析路徑
2. **seedFile 參數的重要性**：在 monorepo 中必須明確指定 seed 檔案位置
3. **文件化配置**：將此類配置記錄在 `CLAUDE.md` 和 `AGENTS.md` 中，避免重複踩坑
