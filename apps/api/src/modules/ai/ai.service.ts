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

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
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
          model: 'gpt-5.2',
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

      const data = await response.json();
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
}
