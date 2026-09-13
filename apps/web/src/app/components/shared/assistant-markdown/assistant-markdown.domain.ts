import { marked, Renderer } from 'marked';

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
const TABLE_DELIMITER_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const INLINE_CODE_PATTERN = /(`+)([^`]*?)\1/g;
const INLINE_CODE_PLACEHOLDER_START = '\uE000';
const INLINE_CODE_PLACEHOLDER_END = '\uE001';
const safeRenderer = new Renderer();
export const ASSISTANT_MARKDOWN_OPTIONS = { gfm: true, breaks: true } as const;

safeRenderer.html = ({ text }) => escapeHtml(text);

/**
 * 將 AI 常見但不完全符合 CommonMark 的輸出正規化。
 *
 * 只修正已知的鬆散格式，並避開 fenced code 與 inline code，讓實際的
 * Markdown 語意仍交由 marked 處理。
 */
export function normalizeAssistantMarkdown(content: string): string {
  const lines = content.split('\n');
  const normalized: string[] = [];
  let fenceMarker: string | null = null;
  let inTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(FENCE_PATTERN);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceMarker) {
        fenceMarker = marker;
      } else if (marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length) {
        fenceMarker = null;
      }
      inTable = false;
      normalized.push(line);
      continue;
    }

    if (fenceMarker) {
      normalized.push(line);
      continue;
    }

    const nextLine = lines[index + 1];
    if (!inTable && nextLine !== undefined && isTableHeader(line, nextLine)) {
      inTable = true;
    } else if (inTable && line.trim() === '') {
      inTable = false;
    } else if (inTable && !isTableRow(line)) {
      normalized.push('');
      inTable = false;
    }

    normalized.push(normalizeStrongMarkersOutsideInlineCode(line));
  }

  return normalized.join('\n');
}

export function renderAssistantMarkdown(content: string): string {
  const rendered = marked.parse(normalizeAssistantMarkdown(content), {
    async: false,
    ...ASSISTANT_MARKDOWN_OPTIONS,
    renderer: safeRenderer,
  });

  return rendered.replace(
    /<table>([\s\S]*?)<\/table>/g,
    (_match, tableContent: string) =>
      `<div class="assistant-markdown-table-wrap"><table>${tableContent}</table></div>`,
  );
}

function isTableHeader(line: string, nextLine: string): boolean {
  return line.includes('|') && TABLE_DELIMITER_PATTERN.test(nextLine);
}

function isTableRow(line: string): boolean {
  return line.includes('|');
}

function normalizeStrongMarkersOutsideInlineCode(line: string): string {
  const codeSpans: string[] = [];
  const protectedLine = line.replace(INLINE_CODE_PATTERN, (match) => {
    const placeholder = `${INLINE_CODE_PLACEHOLDER_START}${codeSpans.length}${INLINE_CODE_PLACEHOLDER_END}`;
    codeSpans.push(match);
    return placeholder;
  });

  // 逐組消耗標記，結尾不會再次被當成下一組的開頭。
  // 跳脫、巢狀星號與奇數標記無法安全推斷，維持原文。
  const runs = [...protectedLine.matchAll(/\*+/g)];
  if (protectedLine.includes('\\') || runs.length % 2 !== 0 || runs.some((run) => run[0] !== '**'))
    return line;

  let normalized = '';
  let cursor = 0;
  for (let index = 0; index < runs.length; index += 2) {
    const start = runs[index].index!;
    const end = runs[index + 1].index! + 2;
    const original = protectedLine.slice(start, end);
    const tokens = marked.Lexer.lexInline(original);
    let replacement = original;
    const following = protectedLine.slice(end, end + 1);
    const contextualTokens = marked.Lexer.lexInline(original + following);
    if (
      tokens.length === 1 &&
      tokens[0].type === 'strong' &&
      contextualTokens[0]?.type !== 'strong' &&
      /[：:；;，,。！？!?]\*\*$/.test(original)
    ) {
      // 僅在緊接內文使結尾標點無法閉合時，將標點移到已確定的配對外。
      replacement = original.replace(/([：:；;，,。！？!?])\*\*$/, '**$1');
    }
    // 已合法的粗體完全不改寫，包括其中的標點與空白。
    if (!(tokens.length === 1 && tokens[0].type === 'strong')) {
      const inner = original.slice(2, -2);
      const leading = inner.match(/^[ \t]+/)?.[0] ?? '';
      const trailing = inner.match(/[ \t]+$/)?.[0] ?? '';
      const trimmed = inner.trim();
      if (trimmed) {
        const candidate = `**${trimmed}**`;
        const parsed = marked.Lexer.lexInline(candidate);
        if (parsed.length === 1 && parsed[0].type === 'strong') {
          replacement = `${leading}${candidate}${trailing}`;
        }
      }
    }
    normalized += protectedLine.slice(cursor, start) + replacement;
    cursor = end;
  }
  normalized += protectedLine.slice(cursor);

  return codeSpans.reduce(
    (result, codeSpan, index) =>
      result.replace(
        `${INLINE_CODE_PLACEHOLDER_START}${index}${INLINE_CODE_PLACEHOLDER_END}`,
        codeSpan,
      ),
    normalized,
  );
}

function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
