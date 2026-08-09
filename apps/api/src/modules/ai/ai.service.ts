import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeneratedMeaning {
  zhMeaning: string;
  enExample?: string;
  zhExample?: string;
}

export interface GenerateCardContentResult {
  meanings: GeneratedMeaning[];
}

export interface GenerateRelatedExampleResult {
  zhMeaning: string;
  enExample: string;
  zhExample: string;
  unfamiliarWords: string[];
  learningWords: string[];
}

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly reasoningEffort: string;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    this.model =
      this.configService.get<string>('COLLECTION_CODEX_MODEL') ?? 'gpt-5.5';
    this.reasoningEffort =
      this.configService.get<string>('COLLECTION_CODEX_REASONING_EFFORT') ??
      'low';
  }

  async generateCardContent(text: string): Promise<GenerateCardContentResult> {
    const prompt = this.buildPrompt(text);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: prompt.system,
            },
            {
              role: 'user',
              content: prompt.user,
            },
          ],
          temperature: 0.7,
          reasoning_effort: this.reasoningEffort,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new InternalServerErrorException({
          error: {
            code: 'AI_SERVICE_ERROR',
            message: 'AI 服務暫時無法使用，請稍後再試',
          },
        });
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new InternalServerErrorException({
          error: {
            code: 'AI_SERVICE_ERROR',
            message: 'AI 服務回應格式錯誤',
          },
        });
      }

      const parsed = this.parseResponse(content);
      return parsed;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'AI 服務暫時無法使用，請稍後再試',
        },
      });
    }
  }

  async generateRelatedExample(
    target: string,
    familiarWords: string[],
  ): Promise<GenerateRelatedExampleResult> {
    const prompt = this.buildRelatedExamplePrompt(target, familiarWords);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.7,
          reasoning_effort: this.reasoningEffort,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        console.error(
          'OpenAI API error:',
          response.status,
          await response.text(),
        );
        throw new InternalServerErrorException({
          error: {
            code: 'AI_SERVICE_ERROR',
            message: 'AI 服務暫時無法使用，請稍後再試',
          },
        });
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new InternalServerErrorException({
          error: { code: 'AI_SERVICE_ERROR', message: 'AI 服務回應格式錯誤' },
        });
      }

      return this.parseRelatedExampleResponse(content);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'AI 服務暫時無法使用，請稍後再試',
        },
      });
    }
  }

  private buildPrompt(text: string): { system: string; user: string } {
    return {
      system: `你是一位專業的英語教學助理，專門幫助台灣學生學習英文單字。
請根據使用者提供的英文單字或片語，生成詞義和例句。

回應格式必須是 JSON，包含以下結構：
{
  "meanings": [
    {
      "zhMeaning": "中文解釋 (詞性)",
      "enExample": "英文例句",
      "zhExample": "例句的中文翻譯"
    }
  ]
}

規則：
1. 一種詞義就一個解釋，每個解釋配一個例句
2. 同一個單字不需要有兩個相同的詞義
3. 若單字有多種不同詞性或詞義，則提供多筆
4. 中文解釋必須包含詞性標註，格式為「解釋 (詞性)」
   - 詞性使用標準縮寫：n.（名詞）、v.（動詞）、adj.（形容詞）、adv.（副詞）、prep.（介係詞）、conj.（連接詞）、interj.（感嘆詞）、phr.（片語）
   - 範例：「跑步 (v.)」、「賽跑 (n.)」、「你好 (interj.)」
5. 中文解釋要簡潔明確
6. 例句要自然且符合日常使用情境
7. 使用正體中文`,
      user: `請為以下英文單字/片語生成詞義和例句：${text}`,
    };
  }

  private buildRelatedExamplePrompt(
    target: string,
    familiarWords: string[],
  ): { system: string; user: string } {
    const wordList =
      familiarWords.length > 0
        ? familiarWords.join(', ')
        : '（目前沒有可用的熟悉字彙）';
    return {
      system: `你是一位專業的英語教學助理，幫助台灣學生透過熟悉字彙建立記憶關聯。
請為指定的目標單字或片語產生一組新的詞義與例句。

回應必須是 JSON：
{
  "zhMeaning": "目標單字在這個句子中的中文解釋 (詞性)",
  "enExample": "英文例句",
  "zhExample": "例句的正體中文翻譯",
  "unfamiliarWords": ["句子中可能是生字的英文單字"]
}

規則：
1. 英文例句必須自然，且必須包含目標單字或片語。
2. 英文例句控制在約 8–12 個單字，使用一個簡單子句，不要堆疊多個情節或使用過長的從句。
3. 優先使用提供的熟悉字彙，但最多只帶入 1–2 個；若不足或不自然，可以自行補足常用字。
4. 句子適合日常英文學習，不要為了塞入字彙而產生不自然的句子。
5. unfamiliarWords 只列出句子中可能尚未學過的內容單字，必須使用它們在英文例句中實際出現的形式；不要列出目標單字，也不要列出冠詞、介系詞、代名詞等基本功能字。
6. 使用正體中文，詞義需包含詞性標註。`,
      user: `目標單字或片語：${target}\n優先使用的熟悉字彙：${wordList}`,
    };
  }

  private parseResponse(content: string): GenerateCardContentResult {
    try {
      const parsed = JSON.parse(content) as { meanings?: GeneratedMeaning[] };

      if (!parsed.meanings || !Array.isArray(parsed.meanings)) {
        throw new Error('Invalid response structure');
      }

      return {
        meanings: parsed.meanings.map((m) => ({
          zhMeaning: m.zhMeaning || '',
          enExample: m.enExample || undefined,
          zhExample: m.zhExample || undefined,
        })),
      };
    } catch {
      throw new InternalServerErrorException({
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'AI 服務回應格式錯誤',
        },
      });
    }
  }

  private parseRelatedExampleResponse(
    content: string,
  ): GenerateRelatedExampleResult {
    try {
      const parsed = JSON.parse(
        content,
      ) as Partial<GenerateRelatedExampleResult>;
      if (!parsed.zhMeaning || !parsed.enExample || !parsed.zhExample) {
        throw new Error('Invalid response structure');
      }
      return {
        zhMeaning: parsed.zhMeaning,
        enExample: parsed.enExample,
        zhExample: parsed.zhExample,
        unfamiliarWords: Array.isArray(parsed.unfamiliarWords)
          ? parsed.unfamiliarWords.filter(
              (word): word is string =>
                typeof word === 'string' && word.trim().length > 0,
            )
          : [],
        learningWords: [],
      };
    } catch {
      throw new InternalServerErrorException({
        error: { code: 'AI_SERVICE_ERROR', message: 'AI 服務回應格式錯誤' },
      });
    }
  }
}
