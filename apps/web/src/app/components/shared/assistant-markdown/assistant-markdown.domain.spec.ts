import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import {
  normalizeAssistantMarkdown,
  renderAssistantMarkdown,
  ASSISTANT_MARKDOWN_OPTIONS,
} from './assistant-markdown.domain';

describe('assistant-markdown.domain', () => {
  it('摘要與討論解析得到相同的粗體範圍與換行', () => {
    const source = '用 **第一組** 說明；**第二組 **和 **第三組**。\n下一行';
    const normalized = normalizeAssistantMarkdown(source);
    const summaryHtml = marked.parser(
      marked.lexer(normalized, ASSISTANT_MARKDOWN_OPTIONS),
      ASSISTANT_MARKDOWN_OPTIONS,
    );
    const expected =
      '<p>用 <strong>第一組</strong> 說明；<strong>第二組</strong> 和 <strong>第三組</strong>。<br>下一行</p>\n';
    expect(summaryHtml).toBe(expected);
    expect(renderAssistantMarkdown(source)).toBe(expected);
    expect(normalizeAssistantMarkdown(normalized)).toBe(normalized);
  });
  it('多組粗體不得把正常段落串進粗體範圍', () => {
    expect(
      renderAssistantMarkdown(
        '用 **not about A; it’s about B** 來對比；**today’s task **和 **worked on**。',
      ),
    ).toBe(
      '<p>用 <strong>not about A; it’s about B</strong> 來對比；<strong>today’s task</strong> 和 <strong>worked on</strong>。</p>\n',
    );
  });

  it('修復行首粗體內側空白', () => {
    expect(renderAssistantMarkdown('** have** 比較自然。')).toBe(
      '<p> <strong>have</strong> 比較自然。</p>\n',
    );
  });

  it.each([
    '**正常** 與 **第二組**',
    '**結論：** 內文',
    '**第一行\n第二行 **說明',
    '**粗體中的 *斜體***',
    '**第一行\n第二行**',
    '`** have **`',
    '\\*\\*have\\*\\*',
    '**未完成',
    '**不確定 ** 與 **未完成',
  ])('合法或配對不明確的內容保持原樣：%s', (source) => {
    expect(normalizeAssistantMarkdown(source)).toBe(source);
  });
  it('應修正 have 尾端空白且同段有下一個粗體的格式', () => {
    const html = renderAssistantMarkdown(
      '差別在於 **have **比較像今天有任務，而 **I’m working on** 更清楚。',
    );
    expect(html).toContain('<strong>have</strong>');
    expect(html).toContain('<strong>I’m working on</strong>');
    expect(html).not.toContain('**');
  });

  it('應修正摘要常見的粗體尾端空白格式', () => {
    const html = renderAssistantMarkdown(
      '用 **not about A; it’s about B ** 來對比主題；**today’s task ** 也更自然。',
    );

    expect(html).toContain('<strong>');
    expect(html).toContain('not about A; it’s about B');
    expect(html).toContain('today’s task');
    expect(html).not.toContain('**');
  });

  it('應修正粗體標記跨越中英文字與中文標點的摘要格式', () => {
    const html = renderAssistantMarkdown(
      '對，**worked on 很常一起使用，意思是「著手做、處理某件事」，後面通常接任務、專案或功能，例如 a project / a task / a feature。這裡的 worked on yesterday **就是「昨天處理的事情」，比單說 worked yesterday 更能表達你做了什麼。',
    );

    expect(html).not.toContain('**');
    expect(html).toContain('<strong>');
    expect(html).toContain('worked on yesterday');
  });
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

  it('應修正中文文字後粗體起始標記黏字且在標記後多留空白的格式', () => {
    const html = renderAssistantMarkdown(
      '還有** “Maybe today I will stop, and tomorrow maybe I will keep going.”**，也很自然。',
    );

    expect(html).toContain(
      '<strong>“Maybe today I will stop, and tomorrow maybe I will keep going.”</strong>',
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
