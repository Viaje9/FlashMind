import { describe, expect, it } from 'vitest';
import { renderAssistantMarkdown } from './assistant-markdown.domain';

describe('assistant-markdown.domain', () => {
  it('應解析中文標點緊接內文的粗體標籤', () => {
    const html = renderAssistantMarkdown('**結論：**兩個字都能表示發生。');

    expect(html).toContain('<strong>結論</strong>：兩個字都能表示發生。');
    expect(html).not.toContain('**');
  });

  it('應修正 AI 將粗體起始標記黏在前字且在標記後多留空白的格式', () => {
    const html = renderAssistantMarkdown(
      [
        '**正面的態度** → a** positive** attitude',
        '**物品的正面** → the** front** of the object',
      ].join('\n'),
    );

    expect(html).toContain('<strong>正面的態度</strong> → a <strong>positive</strong> attitude');
    expect(html).toContain(
      '<strong>物品的正面</strong> → the <strong>front</strong> of the object',
    );
    expect(html).not.toContain('**');
  });

  it('表格後缺少空行時仍應將結論解析成表格外的段落', () => {
    const html = renderAssistantMarkdown(
      ['| 單字 | 用法 |', '| --- | --- |', '| happen | 日常口語 |', '**結論**：依語境選字。'].join(
        '\n',
      ),
    );

    expect(html).toContain('</table></div>');
    expect(html).toContain('<p><strong>結論</strong>：依語境選字。</p>');
    expect(html.indexOf('</table></div>')).toBeLessThan(html.indexOf('<p><strong>結論</strong>'));
  });

  it('應保留合法 GFM 表格並加上橫向捲動容器', () => {
    const html = renderAssistantMarkdown(
      ['| 單字 | 用法 |', '| --- | --- |', '| occur | 正式書面 |'].join('\n'),
    );

    expect(html).toContain('<div class="assistant-markdown-table-wrap"><table>');
    expect(html).toContain('<td>occur</td>');
  });

  it('應將大於符號開頭的內容解析為引用區塊', () => {
    const html = renderAssistantMarkdown('> **conference** = 會議；研討會');

    expect(html).toContain('<blockquote>');
    expect(html).toContain('<strong>conference</strong> = 會議；研討會');
    expect(html).not.toContain('&gt;');
  });

  it('不應把程式碼中的 Markdown 標記轉成 HTML', () => {
    const html = renderAssistantMarkdown(
      ['`**結論：**文字`', '', '```md', '**結論：**文字', '```'].join('\n'),
    );

    expect(html).toContain('<code>**結論：**文字</code>');
    expect(html).toContain('<code class="language-md">**結論：**文字');
  });

  it('應跳脫 AI 回應中的原始 HTML', () => {
    const html = renderAssistantMarkdown('<img src=x onerror=alert(1)>');

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
