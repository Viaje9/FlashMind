interface ApiError {
  code: string;
  message: string;
  details?: Array<{ path: string; code: string; message: string }>;
  truncated?: true;
}

export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: number,
    readonly details?: unknown,
    readonly apiError?: ApiError,
  ) {
    super(message);
  }
}

// 只取錯誤契約中的診斷欄位，不直接印出 response、headers、stack 或回傳的草稿。
export async function readApiError(
  response: Response,
  token?: string,
  requestBody?: unknown,
): Promise<ApiError | undefined> {
  try {
    if (!response.body) return;
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 64 * 1024) return;
      chunks.push(chunk);
    }
    const error = JSON.parse(Buffer.concat(chunks).toString("utf8"))?.error;
    if (
      !error ||
      typeof error.code !== "string" ||
      !/^[A-Z][A-Z0-9_]{0,99}$/.test(error.code) ||
      typeof error.message !== "string"
    )
      return;

    const privateValues = new Set<string>(token ? [token] : []);
    const collectPrivateText = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (
          /^(text|quote|summary|review|naturalSentence|password|token|verifier|verifierHash)$/.test(
            key,
          ) &&
          typeof item === "string" &&
          item.trim().length >= 8
        )
          privateValues.add(item.trim());
        else if (typeof item === "object") collectPrivateText(item);
      }
    };
    collectPrivateText(requestBody);
    const hidden = [...privateValues].sort((a, b) => b.length - a.length);
    const sanitize = (value: string): string => {
      for (const privateValue of hidden)
        value = value.split(privateValue).join("[已隱藏]");
      // 避免終端控制字元；遮蔽必須在截短之前，不能留下 token 或原句的前半段。
      value = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
      return value.length > 1000 ? value.slice(0, 1000) + "…[已截短]" : value;
    };
    const result: ApiError = {
      code: sanitize(error.code),
      message: sanitize(error.message),
    };
    if (Array.isArray(error.details)) {
      result.details = error.details.slice(0, 20).flatMap((issue: unknown) => {
        if (!issue || typeof issue !== "object") return [];
        const { path, code, message } = issue as Record<string, unknown>;
        if (
          typeof path !== "string" ||
          typeof code !== "string" ||
          typeof message !== "string"
        )
          return [];
        return [
          {
            path: sanitize(path),
            code: sanitize(code),
            message: sanitize(message),
          },
        ];
      });
      if (error.details.length > 20) result.truncated = true;
    }
    return result;
  } catch {
    // HTML、破損 JSON、讀取逾時等情況不可蓋掉原本的 HTTP 錯誤。
    return;
  }
}
