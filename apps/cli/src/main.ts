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
  type SpeakingSavedReview,
} from "@flashmind/shared";
import { CliError, readApiError } from "./errors";
import {
  checkContext,
  isReviewId,
  parseLocalCommand,
  readManagedDraft,
  recordReceipt,
  runLocalCommand,
  validateLocalReview,
} from "./review-local";
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
const help = `flashmind — 練習上下文與 Review 保存

  flashmind login [--no-browser]
  flashmind status [--check]
  flashmind practice context
  flashmind transcript export <thread> --before-message <id> [--output-temp]
  flashmind transcript export --current [--output-temp]
  flashmind transcript show <thread | --current> [--offset 0] [--limit 50]
  flashmind review prepare <thread | --current> --before-message <id> [--from-message <id>] [--title <標題>]
  flashmind review import --file <既有完整草稿.json>
  flashmind review refresh <id>
  flashmind review list [--offset 0] [--limit 50]
  flashmind review show <id> [--section metadata|transcript|context|draft|result|review|summary|actualUses|recommendations|nextPractice|deckCandidates] [--offset 0] [--limit 50]
  flashmind review vocabulary <id> [--terms task,limited] [--offset 0] [--limit 50]
  flashmind review update <id> --result <回顧內容.json>
  flashmind review validate <file | id>
  flashmind review save <file | id>

API 優先序：--api-url > FLASHMIND_API_URL > 最近成功登入的環境。登入成功才切換預設；其他指令覆寫只影響本次。
憑證：FLASHMIND_CONFIG_DIR，預設 ~/.config/flashmind；不得放在 repo。
本機資料：FLASHMIND_DATA_DIR，預設 ~/.local/share/flashmind；與 repo、憑證分開。
prepare／import／refresh 只 GET 最新 context；list／show／vocabulary／update／validate 不需登入、不連線。
show 的分頁只用於 transcript；vocabulary 和 list 支援分頁，limit 上限 200。
validate 只做本機驗證、不寫檔；傳入 ID 可核對字庫快照，獨立草稿檔只檢查契約與原句證據。
只有 save 上傳完整草稿，由保存 API 驗證後正式寫入；不另呼叫遠端 validate。
`;

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(help);
    return null;
  }
  let rawOrigin = process.env.FLASHMIND_API_URL;
  const index = args.indexOf("--api-url");
  if (index >= 0) {
    if (!args[index + 1] || args[index + 1].startsWith("-"))
      throw new CliError("USAGE_ERROR", "--api-url 必須提供網址", 2);
    rawOrigin = args[index + 1];
    args.splice(index, 2);
  }
  const noBrowser = args.includes("--no-browser");
  if (noBrowser) args.splice(args.indexOf("--no-browser"), 1);
  const check = args.includes("--check");
  if (check) args.splice(args.indexOf("--check"), 1);
  const local = parseLocalCommand(args);
  const command = local
    ? "local"
    : args[0] === "status" && args.length === 1
      ? "status"
      : args[0] === "login" && args.length === 1
        ? "login"
        : args[0] === "practice" && args[1] === "context" && args.length === 2
          ? "context"
          : args[0] === "review" &&
              ["validate", "save"].includes(args[1]) &&
              args.length === 3 &&
              !args[2].startsWith("-")
            ? args[1]
            : null;
  if (
    !command ||
    (noBrowser && command !== "login") ||
    (check && command !== "status")
  )
    throw new CliError("USAGE_ERROR", "請使用 --help 查看命令及必要參數", 2);
  return { command, rawOrigin, file: args[2], noBrowser, check, local };
}

function normalizeOrigin(rawOrigin: string): string {
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
  return url.origin;
}

async function configDirectory(): Promise<string> {
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
  return real;
}
async function credentialFile(origin: string): Promise<string> {
  return join(
    await configDirectory(),
    createHash("sha256").update(origin).digest("hex") + ".json",
  );
}
async function loadCredential(
  origin: string,
  allowExpired = false,
): Promise<Credential> {
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
        typeof value.email !== "string" ||
        !/^[A-Za-z0-9._~-]+$/.test(value.token) ||
        !Number.isFinite(Date.parse(value.expiresAt)) ||
        (!allowExpired && !(Date.parse(value.expiresAt) > Date.now()))
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

async function activeOrigin(): Promise<string | undefined> {
  try {
    const handle = await open(
      join(await configDirectory(), "active.json"),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.size > 16384 ||
        (info.mode & 0o077) !== 0 ||
        (process.getuid && info.uid !== process.getuid())
      )
        throw new Error("unsafe config");
      const value = JSON.parse(await handle.readFile("utf8"));
      if (value.schemaVersion !== 1 || typeof value.apiOrigin !== "string")
        throw new Error("invalid config");
      return normalizeOrigin(value.apiOrigin);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (error instanceof CliError) throw error;
    throw new CliError(
      "CONFIG_INVALID",
      "目前環境設定損壞或權限不安全；請以 --api-url 重新登入",
      2,
    );
  }
}
async function saveActiveOrigin(origin: string) {
  const directory = await configDirectory();
  const temp = join(directory, `.active-${randomBytes(12).toString("hex")}`);
  const handle = await open(temp, "wx", 0o600);
  try {
    try {
      await handle.writeFile(
        JSON.stringify({ schemaVersion: 1, apiOrigin: origin }),
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, join(directory, "active.json"));
  } catch {
    await unlink(temp).catch(() => {});
    throw new CliError(
      "CONFIG_WRITE_FAILED",
      "登入憑證已保存，但預設環境未更新；可帶 --api-url 使用",
      6,
    );
  }
}
async function showStatus(
  origin: string | undefined,
  originSource: string,
  check: boolean,
) {
  if (!origin) {
    output({
      status: "unconfigured",
      apiOrigin: null,
      checked: false,
      message: "請先執行 flashmind login --api-url <origin>",
    });
    if (check) process.exitCode = 2;
    return;
  }
  let credential: Credential | undefined;
  try {
    credential = await loadCredential(origin, true);
    if (check) {
      const { data } = await request(origin, "/auth/me", undefined, credential);
      const user = data as { id?: string; email?: string } | null;
      if (
        !user ||
        typeof user.id !== "string" ||
        typeof user.email !== "string"
      )
        throw new CliError("RESPONSE_INVALID", "帳號檢查回應不完整", 6);
      if (user.id !== credential.userId)
        throw new CliError(
          "TARGET_MISMATCH",
          "伺服器帳號與本機登入不同，未切換帳號",
          4,
        );
    }
    output({
      status:
        !check && Date.parse(credential.expiresAt) <= Date.now()
          ? "expired"
          : "authenticated",
      apiOrigin: origin,
      originSource,
      checked: check,
      userId: credential.userId,
      email: credential.email,
      expiresAt: credential.expiresAt,
    });
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    output({
      status:
        error.code === "AUTH_REQUIRED" ? "login_required" : "check_failed",
      apiOrigin: origin,
      originSource,
      checked: check && Boolean(credential),
      error: {
        code: error.code,
        message: error.message,
        ...(error.apiError ? { apiError: error.apiError } : {}),
      },
    });
    if (check || error.code !== "AUTH_REQUIRED")
      process.exitCode = error.exitCode;
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
      undefined,
      await readApiError(response, credential?.token, body),
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
      await saveActiveOrigin(origin);
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
  if (args.command === "validate") {
    const result = await validateLocalReview(args.file);
    output(result);
    if (!result.valid) process.exitCode = 4;
    return;
  }
  if (
    args.local &&
    !["prepare", "refresh", "import"].includes(args.local.command)
  ) {
    const result = await runLocalCommand(args.local);
    output(result);
    return;
  }
  const origin = args.rawOrigin
    ? normalizeOrigin(args.rawOrigin)
    : await activeOrigin();
  const originSource = args.rawOrigin
    ? process.argv.includes("--api-url")
      ? "argument"
      : "environment"
    : "saved";
  if (args.command === "status") {
    await showStatus(origin, originSource, args.check);
    return;
  }
  if (!origin)
    throw new CliError(
      "CONFIG_REQUIRED",
      "尚未設定環境，請先執行 flashmind login --api-url <origin>",
      2,
    );
  if (args.command === "login") {
    await login(origin, args.noBrowser);
    return;
  }
  const credential = await loadCredential(origin);
  const getContext = async (target?: SpeakingReviewDraft["target"]) => {
    const currentTarget = { apiOrigin: origin, userId: credential.userId };
    if (
      target &&
      (target.apiOrigin !== origin || target.userId !== credential.userId)
    )
      throw new CliError(
        "TARGET_MISMATCH",
        "草稿帳號或 API origin 與本機登入不同，未傳送資料",
        4,
      );
    const { data } = await request(
      origin,
      "/speaking/practice-context",
      undefined,
      credential,
    );
    const context = data as SpeakingPracticeContext;
    checkContext(context, currentTarget);
    return { target: currentTarget, email: credential.email, context };
  };
  if (args.local) {
    output(await runLocalCommand(args.local, getContext));
    return;
  }
  if (args.command === "context") {
    output((await getContext()).context);
    return;
  }
  const managed = isReviewId(args.file);
  const draft = managed
    ? await readManagedDraft(args.file, {
        apiOrigin: origin,
        userId: credential.userId,
      })
    : await readDraft(args.file, credential);
  // 保存 API 會在交易中核對即時帳號、字庫及重複來源，不預先上傳到驗證 endpoint。
  const saved = await request(origin, "/speaking/reviews", draft, credential);
  if (validateStructure("SpeakingSavedReview", saved.data).length)
    throw new CliError(
      "RESPONSE_INVALID",
      "保存回應格式錯誤，可使用同一草稿重試",
      6,
    );
  if (managed) {
    try {
      await recordReceipt(args.file, draft, saved.data as SpeakingSavedReview);
    } catch {
      // 正式保存已成功，不能將本機收據失敗描述成遠端保存失敗。
      output(saved.data);
      process.stderr.write(
        "API 已保存成功，但本機收據未更新；請保留上方場次 ID，勿另建來源識別。\n",
      );
      return;
    }
  }
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
      ...(failure.apiError ? { apiError: failure.apiError } : {}),
    },
  });
  process.exitCode = failure.exitCode;
});
