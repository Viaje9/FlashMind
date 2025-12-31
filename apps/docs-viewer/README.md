# FlashMind 文件速覽

這是一個行動優先的 docs 檢視工具，方便用手機快速瀏覽專案文件。

## 目錄

- `src/content/docs/`：文件來源（Markdown）
- `src/pages/`：首頁與文件頁
- `src/styles/`：全域樣式

## 開發指令

在專案根目錄執行：

```bash
pnpm --filter ./apps/docs-viewer dev
```

建置與預覽：

```bash
pnpm --filter ./apps/docs-viewer build
pnpm --filter ./apps/docs-viewer preview
```
