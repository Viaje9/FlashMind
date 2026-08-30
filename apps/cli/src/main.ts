import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  SPEAKING_MAX_BYTES,
  validateReviewDraft,
  validateStructure,
  type CliAuthorizationStarted,
  type CliAuthorizationStatus,
  type SpeakingPracticeContext,
  type SpeakingReviewDraft,
  type SpeakingReviewValidation,
} from "@flashmind/shared";

class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
interface Credential {
  schemaVersion: 1;
  apiOrigin: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
}
const output = (value: unknown) =>
  process.stdout.write(JSON.stringify(value) + "\n");
const help = `flashmind — 練習上下文與 Review 保存\n\n  flashmind login [--no-browser]\n  flashmind practice context\n  flashmind review validate <file>\n  flashmind review save <file>\n\n共用參數：--api-url <origin>（亦可設定 FLASHMIND_API_URL）\n憑證：FLASHMIND_CONFIG_DIR，預設 ~/.config/flashmind；不得放在 repo。\ncontext／validate 不保存學習紀錄；save 才正式寫入。\n`;

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(help);
    return null;
  }
  let rawOrigin = process.env.FLASHMIND_API_URL;
  const index = args.indexOf("--api-url");
  if (index >= 0) {
    rawOrigin = args[index + 1];
    args.splice(index, 2);
  }
  const noBrowser = args.includes("--no-browser");
  if (noBrowser) args.splice(args.indexOf("--no-browser"), 1);
  const command =
    args[0] === "login" && args.length === 1
      ? "login"
      : args[0] === "practice" && args[1] === "context" && args.length === 2
        ? "context"
        : args[0] === "review" &&
            ["validate", "save"].includes(args[1]) &&
            args.length === 3 &&
            !args[2].startsWith("-")
          ? args[1]
          : null;
  if (!command || (noBrowser && command !== "login"))
    throw new CliError(
      "USAGE_ERROR",
      "請使用 --help 查看四個命令及必要參數",
      2,
    );
  if (!rawOrigin)
    throw new CliError(
      "CONFIG_REQUIRED",
      "請以 --api-url 或 FLASHMIND_API_URL 指定 FlashMind API origin",
      2,
    );
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new CliError("CONFIG_INVALID", "API URL 格式錯誤", 2);
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/api", "/api/"].includes(url.pathname) ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new CliError(
      "CONFIG_INVALID",
      "請指定 HTTPS origin；只有 localhost 可使用 HTTP，不可含帳密或查詢參數",
      2,
    );
  }
  return { command, origin: url.origin, file: args[2], noBrowser };
}

async function credentialFile(origin: string): Promise<string> {
  const directory = resolve(
    process.env.FLASHMIND_CONFIG_DIR ?? join(homedir(), ".config", "flashmind"),
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new CliError("CONFIG_UNSAFE", "憑證目錄不可為符號連結", 2);
  const real = await realpath(directory),
    repo = await realpath(resolve(__dirname, "../../.."));
  const fromRepo = relative(repo, real);
  if (!fromRepo || (!fromRepo.startsWith("..") && !isAbsolute(fromRepo)))
    throw new CliError("CONFIG_UNSAFE", "請將憑證目錄放在 repo 外", 2);
  await chmod(directory, 0o700);
  return join(
    real,
    createHash("sha256").update(origin).digest("hex") + ".json",
  );
}
async function loadCredential(origin: string): Promise<Credential> {
  try {
    const file = await open(
      await credentialFile(origin),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const info = await file.stat();
      if (
        (info.mode & 0o077) !== 0 ||
        (process.getuid && info.uid !== process.getuid()) ||
        info.size > 16384
      )
        throw new Error("unsafe credential");
      const value = JSON.parse(await file.readFile("utf8")) as Credential;
      if (
        value.schemaVersion !== 1 ||
        value.apiOrigin !== origin ||
        !value.userId ||
        !/^[A-Za-z0-9._~-]+$/.test(value.token) ||
        !(Date.parse(value.expiresAt) > Date.now())
      )
        throw new Error("invalid credential");
      return value;
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      "AUTH_REQUIRED",
      "尚未登入、憑證權限不安全或 session 已過期，請執行 flashmind login",
      3,
    );
  }
}
async function saveCredential(value: Credential) {
  const file = await credentialFile(value.apiOrigin),
    temp = join(dirname(file), `.login-${randomBytes(12).toString("hex")}`);
  const handle = await open(temp, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value));
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temp, file);
  } catch {
    await unlink(temp).catch(() => {});
    throw new CliError(
      "CONFIG_WRITE_FAILED",
      "無法保存登入憑證，請重新登入",
      6,
    );
  }
}

async function request(
  origin: string,
  path: string,
  body?: unknown,
  credential?: Credential,
): Promise<{ data: unknown; response: Response }> {
  // 固定 origin，拒絕 redirect，避免 session 被帶往其他主機。
  const url = new URL(`/api${path}`, origin);
  if (url.origin !== origin || (credential && credential.apiOrigin !== origin))
    throw new CliError("ORIGIN_MISMATCH", "禁止跨 origin 傳送登入資訊", 3);
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(credential ? { cookie: `session=${credential.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new CliError(
      "NETWORK_ERROR",
      "連線失敗或逾時；可使用同一草稿重試，不會重複計次",
      6,
    );
  }
  if ([401, 403, 410].includes(response.status))
    throw new CliError(
      "AUTH_REQUIRED",
      "登入失效、授權過期或帳號無權限，請重新登入",
      3,
    );
  if (response.status === 409)
    throw new CliError(
      "CONFLICT",
      "相同來源已有不同內容或授權已兌換，請檢查紀錄；不要更換來源識別繞過衝突",
      5,
    );
  if (response.status >= 300 && response.status < 400)
    throw new CliError(
      "REDIRECT_DENIED",
      "API redirect 已拒絕，請核對 API origin",
      6,
    );
  if (response.status === 413)
    throw new CliError("PAYLOAD_TOO_LARGE", "文字資料超過 2 MiB 上限", 4);
  if (!response.ok)
    throw new CliError(
      response.status === 422 || response.status === 400
        ? "VALIDATION_FAILED"
        : "API_ERROR",
      `API 請求失敗（HTTP ${response.status}）；未變更本機草稿`,
      response.status === 400 || response.status === 422 ? 4 : 6,
    );
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    if (!response.body) throw new Error("empty body");
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > SPEAKING_MAX_BYTES)
        throw new CliError(
          "RESPONSE_TOO_LARGE",
          "完整回應超過 2 MiB，不會輸出截斷資料",
          4,
        );
      chunks.push(chunk);
    }
    const wrapper = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!wrapper || !Object.hasOwn(wrapper, "data"))
      throw new Error("invalid wrapper");
    return { data: wrapper.data, response };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("RESPONSE_INVALID", "API 未回傳完整 JSON Wrapper", 6);
  }
}

async function login(origin: string, noBrowser: boolean) {
  await credentialFile(origin);
  const verifier = randomBytes(32).toString("base64url");
  const { data } = await request(origin, "/auth/cli/authorizations", {
    verifierHash: createHash("sha256").update(verifier).digest("hex"),
  });
  if (validateStructure("CliAuthorizationStarted", data).length)
    throw new CliError("RESPONSE_INVALID", "登入授權回應不完整", 6);
  const grant = data as CliAuthorizationStarted,
    browserUrl = new URL(grant.verificationUrl);
  if (
    !["http:", "https:"].includes(browserUrl.protocol) ||
    browserUrl.username ||
    browserUrl.password
  )
    throw new CliError("RESPONSE_INVALID", "登入確認網址不安全", 6);
  process.stderr.write(
    `請在 FlashMind 確認登入帳號，輸入配對碼 ${grant.pairingCode}\n${browserUrl.href}\n`,
  );
  if (!noBrowser) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? null
          : "xdg-open";
    if (command) {
      const child = spawn(command, [browserUrl.href], {
        stdio: "ignore",
        detached: true,
      });
      child.on("error", () =>
        process.stderr.write("無法自動開啟瀏覽器，請手動開啟上述網址。\n"),
      );
      child.unref();
    }
  }
  const expires = Math.min(Date.parse(grant.expiresAt), Date.now() + 5 * 60000);
  while (Date.now() < expires) {
    const { data: rawStatus, response } = await request(
      origin,
      `/auth/cli/authorizations/${encodeURIComponent(grant.authorizationId)}/exchange`,
      { verifier },
    );
    if (validateStructure("CliAuthorizationStatus", rawStatus).length)
      throw new CliError("RESPONSE_INVALID", "登入交換回應不完整", 6);
    const status = rawStatus as CliAuthorizationStatus;
    if (status.status === "denied")
      throw new CliError("LOGIN_DENIED", "已取消登入，原登入設定保持不變", 3);
    if (status.status === "approved") {
      const cookie = response.headers
        .getSetCookie()
        .map((value) => /^session=([A-Za-z0-9._~-]+);/.exec(value)?.[1])
        .find(Boolean);
      if (!cookie || !status.userId || !status.email)
        throw new CliError(
          "RESPONSE_INVALID",
          "授權完成但未收到有效 session",
          6,
        );
      await saveCredential({
        schemaVersion: 1,
        apiOrigin: origin,
        userId: status.userId,
        email: status.email,
        token: cookie,
        expiresAt: status.expiresAt,
      });
      output({
        status: "authenticated",
        apiOrigin: origin,
        userId: status.userId,
        email: status.email,
        expiresAt: status.expiresAt,
      });
      return;
    }
    await delay(Math.max(250, Math.min(grant.pollIntervalMs, 5000)));
  }
  throw new CliError(
    "LOGIN_EXPIRED",
    "登入授權已過期，請重新執行 flashmind login",
    3,
  );
}

async function readDraft(
  file: string,
  credential: Credential,
): Promise<SpeakingReviewDraft> {
  let raw: unknown;
  try {
    const handle = await open(resolve(file), "r");
    try {
      if ((await handle.stat()).size > SPEAKING_MAX_BYTES)
        throw new CliError("PAYLOAD_TOO_LARGE", "草稿超過 2 MiB", 4);
      const bytes = await handle.readFile();
      if (bytes.length > SPEAKING_MAX_BYTES)
        throw new CliError("PAYLOAD_TOO_LARGE", "草稿超過 2 MiB", 4);
      raw = JSON.parse(bytes.toString("utf8"));
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      "DRAFT_PARSE_ERROR",
      "無法讀取草稿或 JSON 格式錯誤，原檔保持不變",
      2,
    );
  }
  const errors = validateReviewDraft(raw);
  if (errors.length)
    throw new CliError("DRAFT_INVALID", "草稿驗證失敗", 4, errors);
  const draft = raw as SpeakingReviewDraft;
  if (
    draft.target.userId !== credential.userId ||
    draft.target.apiOrigin !== credential.apiOrigin
  )
    throw new CliError(
      "TARGET_MISMATCH",
      "草稿帳號或 API origin 與本機登入不同",
      4,
    );
  return draft;
}
async function main() {
  const args = parseArgs();
  if (!args) return;
  if (args.command === "login") {
    await login(args.origin, args.noBrowser);
    return;
  }
  const credential = await loadCredential(args.origin);
  if (args.command === "context") {
    const { data } = await request(
      args.origin,
      "/speaking/practice-context",
      undefined,
      credential,
    );
    const context = data as SpeakingPracticeContext;
    if (
      validateStructure("SpeakingPracticeContext", data).length ||
      context.userId !== credential.userId ||
      context.vocabularyCount !== context.targetVocabulary.length ||
      !context.vocabularyVersion ||
      new Set(context.targetVocabulary.map((word) => word.id)).size !==
        context.vocabularyCount
    )
      throw new CliError(
        "CONTEXT_INVALID",
        "上下文不完整、總數不符或帳號不同，不會輸出部分字表",
        4,
      );
    output(context);
    return;
  }
  const draft = await readDraft(args.file, credential);
  const { data } = await request(
    args.origin,
    "/speaking/reviews/validate",
    draft,
    credential,
  );
  if (validateStructure("SpeakingReviewValidation", data).length)
    throw new CliError("RESPONSE_INVALID", "驗證回應格式錯誤", 6);
  const validation = data as SpeakingReviewValidation;
  if (args.command === "validate" || !validation.valid) {
    output(validation);
    if (!validation.valid) process.exitCode = 4;
    return;
  }
  const saved = await request(
    args.origin,
    "/speaking/reviews",
    draft,
    credential,
  );
  if (validateStructure("SpeakingSavedReview", saved.data).length)
    throw new CliError(
      "RESPONSE_INVALID",
      "保存回應格式錯誤，可使用同一草稿重試",
      6,
    );
  output(saved.data);
}
main().catch((error) => {
  const failure =
    error instanceof CliError
      ? error
      : new CliError("CLI_ERROR", "執行失敗，未修改草稿或自動重新產生內容", 6);
  output({
    error: {
      code: failure.code,
      message: failure.message,
      ...(failure.details ? { details: failure.details } : {}),
    },
  });
  process.exitCode = failure.exitCode;
});
