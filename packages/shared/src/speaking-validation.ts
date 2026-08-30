import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "./generated/speaking.schema.json";
import type {
  SpeakingContextWord,
  SpeakingReviewDraft,
  SpeakingSourceRef,
  SpeakingValidationIssue,
} from "./generated/speaking";

export const SPEAKING_MAX_BYTES = 2 * 1024 * 1024;
export const SPEAKING_MAX_MESSAGES = 2000;
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema({ $id: "speaking", ...schema });

export function validateStructure(
  name: keyof typeof schema.definitions,
  value: unknown,
): SpeakingValidationIssue[] {
  const validate = ajv.getSchema(`speaking#/definitions/${name}`);
  if (!validate) throw new Error(`未知的 Speaking schema：${name}`);
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => ({
    path:
      error.instancePath +
      (error.keyword === "additionalProperties"
        ? `/${error.params["additionalProperty"]}`
        : ""),
    code: "SCHEMA_INVALID",
    message: error.message ?? "資料格式錯誤",
  }));
}

export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function speakingSourceKey(ref: SpeakingSourceRef): string {
  return canonicalJson([ref.system, ref.conversationId, ref.sessionKey]);
}

export function normalizeSpeakingTerm(term: string): string {
  return term.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function containsTerm(text: string, term: string): boolean {
  const pattern = normalizeSpeakingTerm(term)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}_'-])${pattern}(?=$|[^\\p{L}\\p{N}_'-])`,
    "u",
  ).test(normalizeSpeakingTerm(text));
}

export function nextVocabularyStatus(
  status: SpeakingContextWord["status"],
  event: "actual-use" | "recommendation",
): SpeakingContextWord["status"] {
  if (status === "ADDED" || status === "USED") return status;
  return event === "actual-use" ? "USED" : "PRACTICING";
}

export interface ReviewValidationContext {
  userId?: string;
  apiOrigin?: string;
  words?: ReadonlyArray<Pick<SpeakingContextWord, "id" | "term" | "status">>;
}

export function validateReviewDraft(
  value: unknown,
  context: ReviewValidationContext = {},
): SpeakingValidationIssue[] {
  const errors = validateStructure("SpeakingReviewDraft", value);
  if (errors.length) return errors;
  const draft = value as SpeakingReviewDraft;
  const issue = (path: string, code: string, message: string) =>
    errors.push({ path, code, message });
  const { practice, result } = draft;
  if (context.userId && context.userId !== draft.target.userId)
    issue("/target/userId", "ACCOUNT_MISMATCH", "草稿帳號與目前登入帳號不同");
  if (context.apiOrigin && context.apiOrigin !== draft.target.apiOrigin)
    issue(
      "/target/apiOrigin",
      "ENVIRONMENT_MISMATCH",
      "草稿 API 環境與目前設定不同",
    );
  if (new URL(draft.target.apiOrigin).origin !== draft.target.apiOrigin)
    issue(
      "/target/apiOrigin",
      "ENVIRONMENT_MISMATCH",
      "API 環境須為完整 origin，不包含路徑或登入資訊",
    );
  if (practice.source === "APP" && !practice.sessionId)
    issue(
      "/practice/sessionId",
      "SESSION_REQUIRED",
      "App Review 必須引用已保存的場次",
    );
  if (practice.source === "LOCAL" && practice.sessionId)
    issue("/practice/sessionId", "SESSION_INVALID", "本機匯入不得覆寫既有場次");
  const start = Date.parse(practice.startedAt),
    end = Date.parse(practice.endedAt);
  if (start > end)
    issue("/practice/endedAt", "TIME_INVALID", "結束時間不可早於開始時間");
  const messages = new Map<
    string,
    SpeakingReviewDraft["practice"]["messages"][number]
  >();
  let previousTime = start;
  for (const [index, message] of practice.messages.entries()) {
    const path = `/practice/messages/${index}`;
    if (messages.has(message.id))
      issue(path + "/id", "MESSAGE_DUPLICATE", "訊息 ID 不得重複");
    messages.set(message.id, message);
    const date = Date.parse(message.createdAt);
    if (date < start || date > end || date < previousTime)
      issue(
        path + "/createdAt",
        "TIME_INVALID",
        "訊息時間須依序排列且位於練習範圍內",
      );
    previousTime = date;
    if (
      practice.source === "LOCAL" &&
      (!message.text.trim() || message.transcriptStatus === "unavailable")
    )
      issue(
        path + "/text",
        "TRANSCRIPT_REQUIRED",
        "新本機 Review 需要原始逐字稿",
      );
  }
  if (
    !practice.messages.some(
      (message) => message.role === "user" && message.text.trim(),
    )
  )
    issue(
      "/practice/messages",
      "USER_MESSAGE_REQUIRED",
      "必須包含使用者的原始文字對話",
    );
  if (
    practice.range.firstMessageId !== practice.messages[0].id ||
    practice.range.lastMessageId !== practice.messages.at(-1)!.id
  )
    issue("/practice/range", "RANGE_INVALID", "範圍必須對應首末訊息");
  const words =
    context.words && new Map(context.words.map((word) => [word.id, word]));
  for (const [field, entries] of [
    ["actualUses", result.actualUses],
    ["recommendations", result.recommendations],
  ] as const) {
    const seen = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const path = `/result/${field}/${index}`;
      if (seen.has(entry.targetVocabularyId))
        issue(path, "EVENT_DUPLICATE", "同場同字同類事件只能一筆");
      seen.add(entry.targetVocabularyId);
      const word = words?.get(entry.targetVocabularyId);
      if (
        words &&
        (!word ||
          normalizeSpeakingTerm(word.term) !==
            normalizeSpeakingTerm(entry.term))
      )
        issue(
          path + "/targetVocabularyId",
          "TARGET_NOT_FOUND",
          "找不到目前帳號的對應目標單字",
        );
      if (!containsTerm(entry.naturalSentence, entry.term))
        issue(
          path + "/naturalSentence",
          "NATURAL_SENTENCE_INVALID",
          "自然例句必須包含該目標字詞",
        );
      if ("evidence" in entry) {
        for (const [evidenceIndex, evidence] of entry.evidence.entries()) {
          const evidencePath = path + `/evidence/${evidenceIndex}`;
          const message = messages.get(evidence.messageId);
          if (
            !message ||
            message.role !== "user" ||
            !message.text.includes(evidence.quote)
          )
            issue(
              evidencePath,
              "EVIDENCE_INVALID",
              "引文必須出自本場使用者的原始訊息",
            );
          else if (!containsTerm(evidence.quote, entry.term))
            issue(
              evidencePath,
              "TERM_NOT_USED",
              "引文中沒有相同獨立字詞，不接受猜測字形或語意替代",
            );
        }
      }
    }
  }
  const used = new Set(
    result.actualUses.map((entry) => entry.targetVocabularyId),
  );
  for (const [index, id] of result.deckCandidates.entries()) {
    if (!used.has(id))
      issue(
        `/result/deckCandidates/${index}`,
        "CANDIDATE_INVALID",
        "加入候選必須來自本次實際使用",
      );
    // 草稿建立後可能已在其他裝置加入，保留當時候選並由顯示端使用目前狀態。
  }
  const terms =
    context.words &&
    new Set(context.words.map((word) => normalizeSpeakingTerm(word.term)));
  for (const [index, term] of result.nextPractice.recallTargets.entries()) {
    if (terms && !terms.has(normalizeSpeakingTerm(term)))
      issue(
        `/result/nextPractice/recallTargets/${index}`,
        "TARGET_NOT_FOUND",
        "回想目標須存在於目前目標字表",
      );
  }
  return errors;
}
