import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  canonicalJson,
  estimateSpeakingDurationMinutes,
  normalizeSpeakingTerm,
  SPEAKING_MAX_BYTES,
  validateReviewDraft,
  validateStructure,
  type SpeakingPracticeContext,
  type SpeakingReviewDraft,
  type SpeakingReviewValidation,
  type SpeakingSavedReview,
} from "@flashmind/shared";
import { CliError } from "./errors";

type Target = SpeakingReviewDraft["target"];
type Practice = SpeakingReviewDraft["practice"];
interface LocalReview {
  schemaVersion: 1;
  id: string;
  target: Target;
  email: string;
  practice: Practice;
  context: SpeakingPracticeContext;
  refreshedAt: string;
  updatedAt: string;
  draft?: SpeakingReviewDraft;
  // 舊版留下的 API 收據僅保留資料，不作為目前本機驗證結果。
  validation?: {
    draftHash: string;
    checkedAt: string;
    result: SpeakingReviewValidation;
  };
  saved?: { draftHash: string; savedAt: string; result: SpeakingSavedReview };
}
export interface LocalCommand {
  command: string;
  id?: string;
  options: Record<string, string>;
}
type FetchContext = (target?: Target) => Promise<{
  target: Target;
  email: string;
  context: SpeakingPracticeContext;
}>;
const idPattern = /^r-([a-f0-9]{16})-([a-f0-9]{32})$/;
const bundleMaxBytes = SPEAKING_MAX_BYTES * 4;
export const isReviewId = (value: string) => idPattern.test(value);
export const draftHash = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const makeId = (target: Target, practice: Practice) =>
  `r-${draftHash(target).slice(0, 16)}-${draftHash(practice.sourceRef).slice(0, 32)}`;
const inside = (parent: string, child: string) => {
  const part = relative(parent, child);
  return (
    !part || (part !== ".." && !part.startsWith("../") && !isAbsolute(part))
  );
};
async function optionalStat(file: string) {
  try {
    return await lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
async function canonicalPath(file: string): Promise<string> {
  if (await optionalStat(file)) return realpath(file);
  return join(
    await canonicalPath(dirname(file)),
    relative(dirname(file), file),
  );
}
async function privateDirectory(file: string, create = false) {
  if (create) await mkdir(file, { recursive: true, mode: 0o700 });
  const info = await optionalStat(file);
  if (!info) return false;
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    info.mode & 0o077 ||
    (process.getuid && info.uid !== process.getuid())
  )
    throw new CliError(
      "DATA_UNSAFE",
      "本機 Review 目錄須為目前使用者的 0700 私有目錄，不可為符號連結",
      2,
    );
  return true;
}
async function dataRoot(create = false) {
  const raw = resolve(
    process.env.FLASHMIND_DATA_DIR ||
      join(homedir(), ".local", "share", "flashmind"),
  );
  if ((await optionalStat(raw))?.isSymbolicLink())
    throw new CliError("DATA_UNSAFE", "資料目錄不可為符號連結", 2);
  const root = await canonicalPath(raw);
  const repo = await realpath(resolve(__dirname, "../../.."));
  const config = await canonicalPath(
    resolve(
      process.env.FLASHMIND_CONFIG_DIR ||
        join(homedir(), ".config", "flashmind"),
    ),
  );
  if (
    inside(repo, root) ||
    inside(root, repo) ||
    inside(config, root) ||
    inside(root, config)
  )
    throw new CliError(
      "DATA_UNSAFE",
      "Review 資料須放在 repo 外，並與憑證目錄分開",
      2,
    );
  await privateDirectory(root, create);
  return root;
}
async function reviewPath(id: string, create = false) {
  const match = idPattern.exec(id);
  if (!match)
    throw new CliError(
      "REVIEW_ID_INVALID",
      "請使用 review list 回傳的完整草稿 ID",
      2,
    );
  let directory = await dataRoot(create);
  for (const part of ["reviews", match[1], match[2]]) {
    directory = join(directory, part);
    await privateDirectory(directory, create);
  }
  return join(directory, "review.json");
}
async function readJson(
  file: string,
  maxBytes: number,
  privateFile = true,
): Promise<unknown> {
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      (privateFile &&
        (stat.mode & 0o077 ||
          (process.getuid && stat.uid !== process.getuid())))
    )
      throw new CliError(
        "DATA_UNSAFE",
        "資料須為目前使用者的私有一般檔案，不可為符號連結",
        2,
      );
    if (stat.size > maxBytes)
      throw new CliError(
        "PAYLOAD_TOO_LARGE",
        "資料超過允許大小，不截斷讀取",
        4,
      );
    const bytes = await handle.readFile();
    if (bytes.length > maxBytes)
      throw new CliError("PAYLOAD_TOO_LARGE", "資料超過允許大小", 4);
    try {
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new CliError("DATA_INVALID", "本機 JSON 格式錯誤，原檔保持不變", 2);
    }
  } finally {
    await handle.close();
  }
}
export function checkContext(context: SpeakingPracticeContext, target: Target) {
  if (
    validateStructure("SpeakingPracticeContext", context).length ||
    context.userId !== target.userId ||
    context.vocabularyCount !== context.targetVocabulary.length ||
    !context.vocabularyVersion ||
    new Set(context.targetVocabulary.map((w) => w.id)).size !==
      context.vocabularyCount
  )
    throw new CliError(
      "CONTEXT_INVALID",
      "上下文不完整、總數不符或帳號不同，不使用部分字表",
      4,
    );
}
async function readReview(id: string): Promise<LocalReview> {
  let raw: unknown;
  try {
    raw = await readJson(await reviewPath(id), bundleMaxBytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new CliError(
        "REVIEW_NOT_FOUND",
        "找不到本機草稿，請執行 review list",
        2,
      );
    throw error;
  }
  const value = raw as LocalReview;
  if (
    !value ||
    value.schemaVersion !== 1 ||
    value.id !== id ||
    !value.target ||
    !value.practice ||
    !value.context ||
    typeof value.email !== "string" ||
    !Number.isFinite(Date.parse(value.refreshedAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw new CliError("DATA_INVALID", "本機 Review 結構不完整", 2);
  checkContext(value.context, value.target);
  checkPractice(value.practice, value.target, value.context);
  if (makeId(value.target, value.practice) !== id)
    throw new CliError(
      "DATA_INVALID",
      "Review ID 與環境、帳號或來源識別不符",
      2,
    );
  return value;
}
// 原始 practice 也使用既有契約檢查；不把占位 result 保存成草稿。
function checkPractice(
  practice: Practice,
  target: Target,
  context: SpeakingPracticeContext,
) {
  const errors = validateReviewDraft({
    schemaVersion: 1,
    target,
    contextVersion: context.vocabularyVersion,
    practice,
    result: {
      summary: "尚未撰寫",
      review: "尚未撰寫",
      actualUses: [],
      recommendations: [],
      deckCandidates: [],
      nextPractice: {
        topic: "待整理",
        speakingGoal: "待整理",
        guidingQuestions: [],
        recallTargets: [],
      },
    },
  });
  if (practice.source !== "LOCAL" || errors.length)
    throw new CliError(
      "PRACTICE_INVALID",
      "本機逐字稿範圍或內容不符契約",
      4,
      errors,
    );
}
async function atomicWrite(file: string, value: LocalReview) {
  const json = JSON.stringify(value, null, 2) + "\n";
  if (Buffer.byteLength(json) > bundleMaxBytes)
    throw new CliError("PAYLOAD_TOO_LARGE", "本機資料超過大小上限", 4);
  const old = await optionalStat(file);
  if (old && (!old.isFile() || old.isSymbolicLink()))
    throw new CliError("DATA_UNSAFE", "拒絕覆蓋非一般資料檔", 2);
  const temp = join(dirname(file), `.write-${randomBytes(12).toString("hex")}`);
  try {
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(json);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
  } finally {
    await unlink(temp).catch(() => {});
  }
}
async function locked<T>(
  id: string,
  action: (file: string) => Promise<T>,
  create = false,
): Promise<T> {
  const file = await reviewPath(id, create),
    lock = join(dirname(file), ".lock");
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new CliError(
        "REVIEW_BUSY",
        "另一個程序正在更新此草稿；稍後重試。若程序已中斷，確認它已結束後再移除該草稿目錄的 .lock",
        5,
      );
    throw error;
  }
  try {
    return await action(file);
  } finally {
    await rmdir(lock);
  }
}
function localCheck(value: LocalReview) {
  const errors = value.draft
    ? validateReviewDraft(value.draft, {
        ...value.target,
        words: value.context.targetVocabulary,
      })
    : [
        {
          path: "/draft",
          code: "DRAFT_REQUIRED",
          message: "請先用 review update 寫入回顧",
        },
      ];
  if (value.draft) {
    if (Buffer.byteLength(JSON.stringify(value.draft)) > SPEAKING_MAX_BYTES)
      errors.push({
        path: "/draft",
        code: "PAYLOAD_TOO_LARGE",
        message: "草稿超過 2 MiB",
      });
    if (value.draft.contextVersion !== value.context.vocabularyVersion)
      errors.push({
        path: "/contextVersion",
        code: "CONTEXT_STALE",
        message: "context 已刷新，請核對最新字庫後用 review update 更新回顧",
      });
    if (canonicalJson(value.draft.practice) !== canonicalJson(value.practice))
      errors.push({
        path: "/practice",
        code: "SOURCE_CONFLICT",
        message: "草稿逐字稿與保存的原文不同",
      });
  }
  return {
    valid: !errors.length,
    scope: "local-snapshot",
    contextGeneratedAt: value.context.generatedAt,
    uploaded: false,
    errors,
    warnings: [
      {
        code: "SNAPSHOT_ONLY",
        message: "僅檢查本機快照，不證明伺服器狀態最新，也不判斷跟讀或內容品質",
      },
    ],
  };
}
async function metadata(value: LocalReview) {
  const hash = value.draft && draftHash(value.draft);
  const status = !hash
    ? "prepared"
    : value.saved?.draftHash === hash
      ? "saved"
      : value.draft!.contextVersion !== value.context.vocabularyVersion
        ? "context-stale"
        : localCheck(value).valid
          ? "validated"
          : "draft";
  return {
    id: value.id,
    path: await reviewPath(value.id),
    target: value.target,
    email: value.email,
    title: value.practice.title,
    sourceRef: value.practice.sourceRef,
    range: value.practice.range,
    startedAt: value.practice.startedAt,
    endedAt: value.practice.endedAt,
    estimatedDurationMinutes: estimateSpeakingDurationMinutes(
      value.practice.startedAt,
      value.practice.endedAt,
    ),
    messageCount: value.practice.messages.length,
    vocabularyCount: value.context.vocabularyCount,
    contextVersion: value.context.vocabularyVersion,
    contextGeneratedAt: value.context.generatedAt,
    refreshedAt: value.refreshedAt,
    updatedAt: value.updatedAt,
    status,
    validationScope: "local-snapshot",
    saved: value.saved?.result ?? null,
  };
}
function page<T>(items: T[], options: Record<string, string>) {
  const offset = Number(options["--offset"] ?? 0),
    limit = Number(options["--limit"] ?? 50);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    nextOffset: offset + limit < items.length ? offset + limit : null,
  };
}
export function parseLocalCommand(args: string[]): LocalCommand | undefined {
  const allowed: Record<string, string[]> = {
    prepare: ["--current", "--before-message", "--from-message", "--title"],
    refresh: [],
    list: ["--offset", "--limit"],
    show: ["--section", "--offset", "--limit"],
    vocabulary: ["--terms", "--offset", "--limit"],
    update: ["--result"],
    import: ["--file"],
  };
  if (args[0] !== "review" || !Object.hasOwn(allowed, args[1]))
    return undefined;
  const command = args[1],
    options: Record<string, string> = {};
  let id: string | undefined;
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-") && id === undefined) {
      id = arg;
      continue;
    }
    if (!allowed[command].includes(arg) || options[arg] !== undefined)
      throw new CliError("USAGE_ERROR", "未知或重複選項，請使用 --help", 2);
    if (arg === "--current") options[arg] = "true";
    else {
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw new CliError("USAGE_ERROR", "選項缺少值", 2);
      options[arg] = args[++i];
    }
  }
  if (
    command === "list" || command === "import"
      ? id !== undefined
      : command === "prepare"
        ? !id === !options["--current"] || !options["--before-message"]
        : !id
  )
    throw new CliError(
      "USAGE_ERROR",
      "請提供草稿 ID；prepare 須有任務來源與 --before-message，--current 不可混用任務 ID",
      2,
    );
  if (
    (command === "update" && !options["--result"]) ||
    (command === "import" && !options["--file"])
  )
    throw new CliError(
      "USAGE_ERROR",
      "update 需要 --result，import 需要 --file",
      2,
    );
  for (const key of ["--offset", "--limit"])
    if (
      options[key] !== undefined &&
      (!/^\d+$/.test(options[key]) ||
        !Number.isSafeInteger(Number(options[key])) ||
        (key === "--limit" &&
          (Number(options[key]) < 1 || Number(options[key]) > 200)))
    )
      throw new CliError(
        "USAGE_ERROR",
        "offset 須為非負整數，limit 須為 1 至 200",
        2,
      );
  if (
    options["--section"] &&
    ![
      "metadata",
      "transcript",
      "context",
      "draft",
      "result",
      "review",
      "summary",
      "actualUses",
      "recommendations",
      "nextPractice",
      "deckCandidates",
    ].includes(options["--section"])
  )
    throw new CliError("USAGE_ERROR", "未知的讀取區塊，請使用 --help", 2);
  return { command, id, options };
}

async function persistPrepared(
  practice: Practice,
  fetched: Awaited<ReturnType<FetchContext>>,
  imported?: SpeakingReviewDraft,
) {
  checkContext(fetched.context, fetched.target);
  checkPractice(practice, fetched.target, fetched.context);
  const id = makeId(fetched.target, practice);
  return locked(
    id,
    async (file) => {
      const old = (await optionalStat(file)) ? await readReview(id) : undefined;
      if (
        old &&
        (canonicalJson(old.target) !== canonicalJson(fetched.target) ||
          canonicalJson({ ...old.practice, title: undefined }) !==
            canonicalJson({ ...practice, title: undefined }))
      )
        throw new CliError(
          "SOURCE_CONFLICT",
          "相同來源識別已有不同原文，未覆蓋或更換來源 key",
          5,
        );
      if (
        old &&
        Date.parse(fetched.context.generatedAt) <
          Date.parse(old.context.generatedAt)
      )
        throw new CliError(
          "CONTEXT_STALE",
          "此次 context 比已保存快照更舊，未覆蓋",
          4,
        );
      if (
        old?.draft &&
        imported &&
        canonicalJson(old.draft) !== canonicalJson(imported)
      )
        throw new CliError(
          "SOURCE_CONFLICT",
          "已存在不同草稿，請讀取並用 review update 明確更新",
          5,
        );
      const now = new Date().toISOString();
      const value: LocalReview = {
        ...old,
        schemaVersion: 1,
        id,
        target: fetched.target,
        email: fetched.email,
        practice: old?.practice ?? practice,
        context: fetched.context,
        refreshedAt: now,
        updatedAt: now,
        ...(imported && !old?.draft ? { draft: imported } : {}),
      };
      // 保存過的來源不自動改寫草稿；新 context 僅供下一次核對。
      await atomicWrite(file, value);
      return metadata(value);
    },
    true,
  );
}
export async function runLocalCommand(
  args: LocalCommand,
  fetchContext?: FetchContext,
): Promise<unknown> {
  const { command, options, id } = args;
  if (command === "prepare") {
    const source = options["--current"] ? ["--current"] : [id!];
    const exportArgs = [
      "export",
      ...source,
      "--before-message",
      options["--before-message"],
    ];
    if (options["--from-message"])
      exportArgs.push("--from-message", options["--from-message"]);
    let practice: Practice;
    try {
      const { buildExport } = require("../src/transcript.cjs");
      const exported = await buildExport(exportArgs);
      practice = {
        ...exported.result.practice,
        title: options["--title"] || "本機英文練習",
      };
    } catch (error) {
      const failure = error as { code?: string; message?: string };
      throw new CliError(
        failure.code || "TRANSCRIPT_INVALID",
        failure.message || "無法取得原始逐字稿",
        2,
      );
    }
    return persistPrepared(practice, await fetchContext!());
  }
  if (command === "import") {
    const draft = (await readJson(
      resolve(options["--file"]),
      SPEAKING_MAX_BYTES,
      false,
    )) as SpeakingReviewDraft;
    const errors = validateReviewDraft(draft);
    if (errors.length || draft.practice.source !== "LOCAL")
      throw new CliError(
        "DRAFT_INVALID",
        "匯入檔不符合本機草稿契約",
        4,
        errors,
      );
    // 只 GET 最新字庫，不把待匯入的舊逐字稿送到 API。
    const fetched = await fetchContext!(draft.target);
    return persistPrepared(draft.practice, fetched, draft);
  }
  if (command === "list") {
    const base = join(await dataRoot(), "reviews");
    const values: Awaited<ReturnType<typeof metadata>>[] = [];
    if (await privateDirectory(base)) {
      for (const account of await readdir(base, { withFileTypes: true })) {
        if (!/^[a-f0-9]{16}$/.test(account.name)) continue;
        const directory = join(base, account.name);
        await privateDirectory(directory);
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          if (!/^[a-f0-9]{32}$/.test(entry.name)) continue;
          const reviewId = `r-${account.name}-${entry.name}`;
          if (await optionalStat(await reviewPath(reviewId)))
            values.push(await metadata(await readReview(reviewId)));
        }
      }
    }
    values.sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
    const { items, ...paging } = page(values, options);
    return { reviews: items, ...paging };
  }
  const value = await readReview(id!);
  if (command === "refresh")
    return persistPrepared(value.practice, await fetchContext!(value.target));
  if (command === "show") {
    const section = options["--section"] ?? "metadata";
    if (section === "metadata") return metadata(value);
    if (section === "transcript") {
      const { messages, ...practice } = value.practice;
      const { items, ...paging } = page(messages, options);
      return { ...practice, messages: items, ...paging };
    }
    if (section === "context") {
      const { targetVocabulary, ...context } = value.context;
      return {
        ...context,
        target: value.target,
        refreshedAt: value.refreshedAt,
        note: "字庫請用 review vocabulary 分頁查詢；此為本機快照",
      };
    }
    if (!value.draft)
      throw new CliError(
        "DRAFT_REQUIRED",
        "尚未撰寫回顧，請使用 review update",
        4,
      );
    if (section === "draft") return value.draft;
    if (section === "result") return value.draft.result;
    return {
      [section]:
        value.draft.result[section as keyof SpeakingReviewDraft["result"]],
    };
  }
  if (command === "vocabulary") {
    const terms = options["--terms"]
      ?.split(",")
      .map(normalizeSpeakingTerm)
      .filter(Boolean);
    const words = value.context.targetVocabulary.filter(
      (w) => !terms || terms.includes(normalizeSpeakingTerm(w.term)),
    );
    const { items, ...paging } = page(words, options);
    return {
      words: items,
      ...paging,
      contextVersion: value.context.vocabularyVersion,
      contextGeneratedAt: value.context.generatedAt,
      missingTerms:
        terms?.filter(
          (term) => !words.some((w) => normalizeSpeakingTerm(w.term) === term),
        ) ?? [],
    };
  }
  if (command === "update") {
    const result = await readJson(
      resolve(options["--result"]),
      SPEAKING_MAX_BYTES,
      false,
    );
    return locked(id!, async (file) => {
      const current = await readReview(id!);
      const draft = {
        schemaVersion: 1,
        target: current.target,
        practice: current.practice,
        contextVersion: current.context.vocabularyVersion,
        result,
      } as SpeakingReviewDraft;
      const next: LocalReview = {
        ...current,
        draft,
        updatedAt: new Date().toISOString(),
      };
      const check = localCheck(next);
      if (!check.valid)
        throw new CliError(
          "DRAFT_INVALID",
          "回顧未通過本機檢查，原草稿保持不變",
          4,
          check.errors,
        );
      if (current.saved && current.saved.draftHash !== draftHash(draft))
        throw new CliError(
          "REVIEW_ALREADY_SAVED",
          "此來源已正式保存，不能改寫成另一份 Review",
          5,
        );
      if (current.draft && draftHash(current.draft) !== draftHash(draft))
        delete next.validation;
      await atomicWrite(file, next);
      return metadata(next);
    });
  }
  throw new CliError("USAGE_ERROR", "未知的本機 Review 命令", 2);
}

export async function readManagedDraft(id: string, target: Target) {
  const value = await readReview(id);
  if (canonicalJson(value.target) !== canonicalJson(target))
    throw new CliError(
      "TARGET_MISMATCH",
      "草稿帳號或 API origin 與本機登入不同",
      4,
    );
  const check = localCheck(value);
  if (!check.valid)
    throw new CliError(
      "DRAFT_INVALID",
      "草稿未通過本機檢查，未上傳",
      4,
      check.errors,
    );
  return value.draft!;
}

export async function validateLocalReview(idOrFile: string) {
  if (isReviewId(idOrFile)) return localCheck(await readReview(idOrFile));
  const raw = await readJson(resolve(idOrFile), SPEAKING_MAX_BYTES, false);
  const errors = validateReviewDraft(raw);
  return {
    valid: errors.length === 0,
    scope: "draft-only",
    uploaded: false,
    contextGeneratedAt: null,
    errors,
    warnings: [
      {
        code: "CONTEXT_NOT_CHECKED",
        message:
          "獨立草稿檔僅檢查契約與原句證據，未核對字庫、目前帳號或遠端場次；匯入後用草稿 ID 可驗證本機字庫快照，伺服器在 save 時做最終驗證",
      },
    ],
  };
}

export async function recordReceipt(
  id: string,
  draft: SpeakingReviewDraft,
  result: SpeakingSavedReview,
) {
  await locked(id, async (file) => {
    const current = await readReview(id);
    if (!current.draft || draftHash(current.draft) !== draftHash(draft))
      throw new CliError(
        "REVIEW_CHANGED",
        "API 已回覆，但本機草稿同時被修改，未將結果標記在不同版本；請核對遠端結果",
        5,
      );
    const now = new Date().toISOString(),
      hash = draftHash(draft);
    current.saved = { draftHash: hash, savedAt: now, result };
    current.updatedAt = now;
    await atomicWrite(file, current);
  });
}
