"use strict";
// Codex 本機語音紀錄匯出；不使用 API、憑證或 AI。
const { readdir, open, mkdtemp } = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const { createInterface } = require("node:readline");
const { homedir, tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const help = `flashmind transcript export <--current | thread-id 或 codex://threads/...>
  --current             使用 CODEX_THREAD_ID 指向的當前對話
  --before-message <id>  結束指令的訊息 ID（此訊息不匯出）
  --from-message <id>    練習開始訊息 ID（多場次必填）
  --output <file>        寫入新的 0600 JSON 檔；省略時輸出 JSON
  --output-temp          寫入私有暫存目錄並回傳路徑
  --list                相容舊用法；不指定邊界時預設匯出原始快照
未指定 --before-message 時含全部語音訊息（可能含 Review），reviewReady=false。
只支援本機 Codex 語音紀錄；讀取 CODEX_HOME（預設 ~/.codex）。
不需要 API origin 或登入，不保存學習紀錄，不覆蓋檔案。
`;
function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}
async function findFiles(dir, id) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const result = [];
  for (const e of entries) {
    if (e.isDirectory())
      result.push(...(await findFiles(join(dir, e.name), id)));
    else if (e.isFile() && e.name.endsWith(`${id}.jsonl`))
      result.push(join(dir, e.name));
  }
  return result;
}
async function run(args) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(help);
    return;
  }
  if (args.shift() !== "export") fail("USAGE_ERROR", help);
  let raw;
  const opts = {};
  while (args.length) {
    const key = args.shift();
    if (Object.hasOwn(opts, key)) fail("USAGE_ERROR", "選項不可重複");
    if (["--current", "--list", "--output-temp"].includes(key))
      opts[key] = true;
    else if (!key.startsWith("-") && raw === undefined) raw = key;
    else if (
      ["--before-message", "--from-message", "--output"].includes(key) &&
      args[0] &&
      !args[0].startsWith("--")
    )
      opts[key] = args.shift();
    else fail("USAGE_ERROR", help);
  }
  if (opts["--current"] && raw !== undefined)
    fail("USAGE_ERROR", "--current 不可與任務 ID 或連結同時使用");
  if (opts["--current"]) {
    raw = process.env.CODEX_THREAD_ID;
    if (!raw)
      fail(
        "CURRENT_THREAD_REQUIRED",
        "找不到 CODEX_THREAD_ID，請在 Codex 對話內執行或明確提供任務 ID",
      );
  }
  const id = opts["--current"]
    ? raw
    : (raw || "").replace(/^codex:\/\/threads\//, "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    fail(
      opts["--current"] ? "CURRENT_THREAD_INVALID" : "USAGE_ERROR",
      "請提供有效的 Codex 任務 ID、連結或 --current",
    );
  if (
    (opts["--output"] && opts["--output-temp"]) ||
    (opts["--list"] &&
      Object.keys(opts).some((key) => !["--list", "--current"].includes(key)))
  )
    fail("USAGE_ERROR", "列出訊息不可混用匯出選項；輸出選項只能選一個");
  if (opts["--from-message"] && !opts["--before-message"])
    fail(
      "BOUNDARY_REQUIRED",
      "指定開始訊息時，也必須指定 --before-message 結束邊界",
    );
  const home = process.env.CODEX_HOME || join(homedir(), ".codex");
  const files = [
    ...(await findFiles(join(home, "sessions"), id)),
    ...(await findFiles(join(home, "archived_sessions"), id)),
  ];
  if (files.length !== 1)
    fail(
      "SOURCE_NOT_UNIQUE",
      "找不到唯一的本機任務紀錄；請確認 CODEX_HOME 與任務 ID",
    );
  const stream = createReadStream(files[0], { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const messages = [];
  let matched = false;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        fail("TRANSCRIPT_INVALID", "紀錄包含不完整 JSON，不輸出截斷資料");
      }
      const p = event.payload;
      if (event.type === "session_meta") matched = p?.id === id;
      if (event.type !== "realtime_item" || p?.type !== "transcript_segment")
        continue;
      if (
        !["user", "assistant"].includes(p.role) ||
        typeof p.text !== "string" ||
        !p.text.trim() ||
        !p.id ||
        !p.realtime_session_id ||
        !Number.isFinite(Date.parse(event.timestamp))
      )
        fail("TRANSCRIPT_INVALID", "語音訊息缺少原文、ID、角色、場次或時間");
      messages.push({
        id: p.id,
        role: p.role,
        text: p.text,
        createdAt: event.timestamp,
        sessionId: p.realtime_session_id,
      });
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  if (!matched) fail("SOURCE_MISMATCH", "紀錄內的任務 ID 與輸入不符");
  if (!messages.length)
    fail(
      "TRANSCRIPT_UNAVAILABLE",
      "找不到原始語音訊息，不以 handoff 摘要代替逐字稿",
    );
  if (new Set(messages.map((m) => m.id)).size !== messages.length)
    fail("TRANSCRIPT_INVALID", "原始訊息 ID 重複");
  let result;
  if (!opts["--before-message"])
    result = {
      schemaVersion: 1,
      conversationId: id,
      reviewReady: false,
      messages,
    };
  else {
    const start = opts["--from-message"]
      ? messages.findIndex((m) => m.id === opts["--from-message"])
      : 0;
    const end = messages.findIndex((m) => m.id === opts["--before-message"]);
    if (start < 0 || end <= start || messages[end].role !== "user")
      fail(
        "BOUNDARY_INVALID",
        "起訖訊息不存在、順序錯誤，或結束指令不是 user 訊息",
      );
    const selected = messages.slice(start, end);
    if (
      new Set([...selected, messages[end]].map((m) => m.sessionId)).size !== 1
    )
      fail(
        "SESSION_AMBIGUOUS",
        "範圍包含多場語音練習，請以 --from-message 指定開始訊息",
      );
    if (
      selected.some(
        (m, i) =>
          i > 0 &&
          Date.parse(m.createdAt) < Date.parse(selected[i - 1].createdAt),
      )
    )
      fail("TRANSCRIPT_INVALID", "訊息時間順序不一致");
    if (selected.length > 2000)
      fail("PAYLOAD_TOO_LARGE", "超過 2000 則訊息，不截斷資料");
    const first = selected[0],
      last = selected.at(-1);
    result = {
      schemaVersion: 1,
      practice: {
        source: "LOCAL",
        sourceRef: {
          system: "local-agent",
          conversationId: id,
          sessionKey: first.id,
        },
        startedAt: first.createdAt,
        endedAt: last.createdAt,
        range: { firstMessageId: first.id, lastMessageId: last.id },
        messages: selected.map(({ sessionId, ...m }) => m),
      },
    };
  }
  const json = JSON.stringify(result, null, 2) + "\n";
  if (Buffer.byteLength(json) > 2 * 1024 * 1024)
    fail("PAYLOAD_TOO_LARGE", "輸出超過 2 MiB，不截斷資料");
  let file = opts["--output"];
  if (opts["--output-temp"])
    file = join(
      await mkdtemp(join(tmpdir(), "flashmind-transcript-")),
      "transcript.json",
    );
  if (file) {
    const target = resolve(file);
    const handle = await open(target, "wx", 0o600);
    try {
      await handle.writeFile(json);
    } finally {
      await handle.close();
    }
    process.stdout.write(
      JSON.stringify({
        path: target,
        messageCount: (result.practice?.messages ?? result.messages).length,
      }) + "\n",
    );
  } else process.stdout.write(json);
}
exports.main = () =>
  run(process.argv.slice(3)).catch((e) => {
    const known =
      e.code &&
      !["EACCES", "ENOENT", "EEXIST"].includes(e.code) &&
      !e.code.startsWith("ERR_");
    process.stdout.write(
      JSON.stringify({
        error: {
          code: known ? e.code : "TRANSCRIPT_IO_ERROR",
          message: known
            ? e.message
            : "無法讀寫本機紀錄；輸出檔不可已存在，請確認路徑與權限",
        },
      }) + "\n",
    );
    process.exitCode = 2;
  });
