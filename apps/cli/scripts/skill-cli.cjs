// 專案與全域 skill 共用此入口；不依賴呼叫端的工作目錄或 PATH。
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

try {
  if (!existsSync(resolve(__dirname, "../dist/main.js")))
    throw new Error("missing build");
  require(resolve(__dirname, "../bin/flashmind.cjs"));
} catch {
  process.stderr.write(
    "FlashMind CLI 尚未建置或專案已搬移；請在專案執行 pnpm build:cli，再執行 pnpm skills:sync。\n",
  );
  process.exitCode = 2;
}
