import { marked, Renderer } from 'marked';

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
const TABLE_DELIMITER_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const INLINE_CODE_PATTERN = /(`+)([^`]*?)\1/g;
const INLINE_CODE_PLACEHOLDER_START = '\uE000';
const INLINE_CODE_PLACEHOLDER_END = '\uE001';
const STRONG_OPENING_SPACE_AFTER_ENGLISH_WORD_PATTERN =
  /\b([A-Za-z0-9]+)\*\*[ \t]+([^*\n]*?\S)\*\*/g;
const STRONG_OPENING_SPACE_AFTER_CJK_PATTERN =
  /([\u3400-\u9fff])\*\*[ \t]+(?=["“‘'A-Za-z0-9\u3400-\u9fff])([^*\n]*?\S)\*\*/g;
const STRONG_TRAILING_SPACE_PATTERN = /\*\*([^*\n]*?\S)[ \t]+\*\*/g;
const STRONG_TRAILING_PUNCTUATION_PATTERN = /\*\*([^*\n]*?)([：:；;，,。！？!?])\*\*(?=\S)/g;
const safeRenderer = new Renderer();

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
    breaks: true,
    gfm: true,
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

  const normalized = protectedLine
    .replace(STRONG_TRAILING_SPACE_PATTERN, '**$1** ')
    .replace(STRONG_TRAILING_PUNCTUATION_PATTERN, '**$1**$2')
    .replace(STRONG_OPENING_SPACE_AFTER_ENGLISH_WORD_PATTERN, '$1 **$2**')
    .replace(STRONG_OPENING_SPACE_AFTER_CJK_PATTERN, '$1 **$2**');

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
