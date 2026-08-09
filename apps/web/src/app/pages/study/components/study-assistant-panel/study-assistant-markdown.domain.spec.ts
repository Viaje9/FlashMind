import { describe, expect, it } from 'vitest';
import { renderStudyAssistantMarkdown } from './study-assistant-markdown.domain';

describe('study-assistant-markdown.domain', () => {
  it('應解析中文標點緊接內文的粗體標籤', () => {
    const html = renderStudyAssistantMarkdown('**結論：**兩個字都能表示發生。');

    expect(html).toContain('<strong>結論</strong>：兩個字都能表示發生。');
    expect(html).not.toContain('**');
  });

  it('表格後缺少空行時仍應將結論解析成表格外的段落', () => {
    const html = renderStudyAssistantMarkdown(
      ['| 單字 | 用法 |', '| --- | --- |', '| happen | 日常口語 |', '**結論**：依語境選字。'].join(
        '\n',
      ),
    );

    expect(html).toContain('</table></div>');
    expect(html).toContain('<p><strong>結論</strong>：依語境選字。</p>');
    expect(html.indexOf('</table></div>')).toBeLessThan(html.indexOf('<p><strong>結論</strong>'));
  });

  it('應保留合法 GFM 表格並加上橫向捲動容器', () => {
    const html = renderStudyAssistantMarkdown(
      ['| 單字 | 用法 |', '| --- | --- |', '| occur | 正式書面 |'].join('\n'),
    );

    expect(html).toContain('<div class="study-assistant-markdown-table-wrap"><table>');
    expect(html).toContain('<td>occur</td>');
  });

  it('不應把程式碼中的 Markdown 標記轉成 HTML', () => {
    const html = renderStudyAssistantMarkdown(
      ['`**結論：**文字`', '', '```md', '**結論：**文字', '```'].join('\n'),
    );

    expect(html).toContain('<code>**結論：**文字</code>');
    expect(html).toContain('<code class="language-md">**結論：**文字');
  });

  it('應跳脫 AI 回應中的原始 HTML', () => {
    const html = renderStudyAssistantMarkdown('<img src=x onerror=alert(1)>');

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
