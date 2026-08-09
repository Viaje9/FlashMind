import {
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { FsrsService, type CardScheduleState } from '../fsrs';
import {
  CreateSpeakingChatDto,
  SpeakingAssistantChatDto,
  type SpeakingAssistantEffort,
  SpeakingChatHistoryItemDto,
} from './dto';

const DEFAULT_SPEAKING_PROMPT = `You are a friendly and patient English conversation partner for a CEFR A2 learner.
Your job is to help the user practice speaking English with simple, clear language.

Guidelines:
- Respond naturally, as in a real conversation (do not sound like a textbook)
- Keep your reply short: 1-3 sentences total
- Use A2-level words and grammar (present simple, present continuous, past simple, "be going to")
- Prefer common daily topics: work, family, food, hobbies, travel, routines
- Avoid idioms, slang, phrasal verbs with rare meanings, and complex clauses
- Keep each sentence short and clear (about 6-12 words when possible)
- If the user makes a mistake, give one gentle correction first, then continue naturally
- After your reply, ask one simple follow-up question to keep the conversation going
- Be warm and encouraging, but do not use long explanations unless the user asks`;

const SUMMARIZE_SYSTEM_PROMPT = `You are a precise conversation summarizer.
Your task is to summarize only what the USER said in the previous conversation turns.

Hard output constraints:
- Return ONLY valid JSON with this exact shape: {"title":"...", "summary":"..."}
- "summary" must be English only, written in first person ("I"), and must not contain Chinese characters
- "title" must be Traditional Chinese (繁體中文), concise and specific (about 8-20 Chinese characters)
- Do not include markdown, code fences, or extra keys`;

const SUMMARIZE_PROMPT = `Based on the conversation above, summarize everything the USER said in first person.
- Preserve completeness: include all meaningful details, examples, preferences, plans, feelings, and constraints mentioned by the user
- Do not omit information just to make it shorter; prioritize fidelity over brevity
- Merge repeated points without losing unique details
- Keep the original meaning and nuance; do not invent new facts
- If a part is unclear from audio, preserve uncertainty explicitly rather than deleting it
- Organize naturally in a coherent flow (prefer chronological order when possible)
- Write in first person as if the user is writing about themselves
- Fix grammar and improve phrasing naturally, but keep the original meaning
- Write the "summary" field in English only, even if the user spoke Chinese
- Do not output Chinese characters in "summary"
- Do not include anything the assistant said
- Also create a concise conversation title in Traditional Chinese that best represents the user's topic
- The title should be specific and clear (roughly 8-20 Chinese characters), no quotes, no punctuation-only title
- Return ONLY valid JSON with this exact shape:
  {"title":"...", "summary":"..."}`;

const ASSISTANT_CHAT_SYSTEM_PROMPT = `You are a helpful English learning assistant for a Traditional Chinese (繁體中文) speaking user.

Guidelines:
- The user is learning English and may ask questions about grammar, vocabulary, sentence patterns, pronunciation, usage, etc.
- Answer in Traditional Chinese (繁體中文) by default, but use English for examples, sentences, and vocabulary
- Be concise and clear
- Provide examples when helpful
- If the user writes in English, you may respond in English or mix both languages as appropriate
- When the user asks whether a word is in their cards or asks about their proficiency, use the vocabulary tools instead of guessing
- Clearly distinguish the user's saved card data from general English knowledge`;

const TRANSLATE_PROMPT = `Translate the user's English text to Traditional Chinese (繁體中文).
- Keep the meaning accurate and natural
- Keep tone and intent
- Return only translated Chinese text with no extra commentary`;

const UPDATE_MEMORY_TOOL = {
  type: 'function',
  function: {
    name: 'update_memory',
    description:
      'Update long-term memory only when stable user preferences, goals, or level information should be remembered.',
    parameters: {
      type: 'object',
      properties: {
        memory: {
          type: 'string',
          description:
            'Full replacement memory text. Keep concise, factual, and under 1200 characters.',
        },
        reason: {
          type: 'string',
          description: 'Why this memory should be updated.',
        },
      },
      required: ['memory'],
      additionalProperties: false,
    },
  },
} as const;

const SEARCH_USER_VOCABULARY_TOOL = {
  type: 'function',
  function: {
    name: 'search_user_vocabulary',
    description:
      'Search the authenticated user vocabulary cards by an English word, phrase, or Chinese meaning. Use this before guessing whether a word is in the user cards.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The word, phrase, or Chinese meaning to search for.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description:
            'Maximum number of matching cards to return. Defaults to 5.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
} as const;

const GET_WORD_PROFICIENCY_TOOL = {
  type: 'function',
  function: {
    name: 'get_word_proficiency',
    description:
      'Get the authenticated user exact vocabulary card proficiency, FSRS state, retrievability, and next review information for an English word.',
    parameters: {
      type: 'object',
      properties: {
        word: {
          type: 'string',
          description: 'The exact English word to look up.',
        },
      },
      required: ['word'],
      additionalProperties: false,
    },
  },
} as const;

const ASSISTANT_VOCABULARY_TOOLS = [
  SEARCH_USER_VOCABULARY_TOOL,
  GET_WORD_PROFICIENCY_TOOL,
] as const;

const ASSISTANT_RESPONSES_TOOLS = ASSISTANT_VOCABULARY_TOOLS.map((tool) => ({
  type: 'function' as const,
  name: tool.function.name,
  description: tool.function.description,
  parameters: tool.function.parameters,
}));

const SPEAKING_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
] as const;

export type SpeakingVoice = (typeof SPEAKING_VOICES)[number];

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      audio?: {
        transcript?: string;
        data?: string;
      };
      tool_calls?: OpenAIChatToolCall[];
    };
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      text_tokens?: number;
      audio_tokens?: number;
    };
    completion_tokens_details?: {
      text_tokens?: number;
      audio_tokens?: number;
    };
  };
}

interface OpenAIChatToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIResponsesOutputItem {
  type?: string;
  role?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  call_id?: string;
  name?: string;
  arguments?: string;
}

interface OpenAIResponsesResponse {
  output_text?: string | null;
  output?: OpenAIResponsesOutputItem[];
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAISpeechRequest {
  model: string;
  voice: SpeakingVoice;
  input: string;
  response_format: 'mp3';
}

interface SpeakingAudioChatPayload {
  audioBuffer: Buffer;
  history: SpeakingChatHistoryItemDto[];
  voice?: SpeakingVoice;
  systemPrompt?: string;
  memory?: string;
  autoMemoryEnabled?: boolean;
}

export interface SpeakingTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptTextTokens: number;
  promptAudioTokens: number;
  completionTextTokens: number;
  completionAudioTokens: number;
}

export interface SpeakingChatResult {
  reply: string;
  model: string;
  usage: SpeakingTokenUsage;
}

export interface SpeakingAudioChatResult {
  transcript: string;
  audioBase64: string;
  model: string;
  usage: SpeakingTokenUsage;
  memoryUpdate?: {
    memory: string;
    reason?: string;
  };
}

export interface SpeakingSummaryResult {
  title: string;
  summary: string;
  usage: SpeakingTokenUsage;
}

export interface SpeakingTranslateResult {
  translatedText: string;
}

export interface SpeakingAssistantChatResult {
  reply: string;
  model: string;
  usage: SpeakingTokenUsage;
  toolCalls: SpeakingAssistantToolCall[];
}

export interface SpeakingAssistantToolCall {
  name: string;
  callId?: string;
  arguments?: string;
  result?: unknown;
}

export type SpeakingAssistantStreamEvent =
  | { type: 'text_delta'; delta: string }
  | {
      type: 'tool_call';
      callId: string;
      name: string;
      arguments: string;
    }
  | { type: 'tool_result'; callId: string; name: string; result: unknown };

export interface SpeakingVoicePreviewResult {
  audioBase64: string;
}

@Injectable()
export class SpeakingService {
  private readonly apiKey: string;
  private readonly textModel: string;
  private readonly audioModel: string;
  private readonly defaultVoice: SpeakingVoice;

  private readonly chatCompletionsUrl =
    'https://api.openai.com/v1/chat/completions';
  private readonly responsesUrl = 'https://api.openai.com/v1/responses';
  private readonly speechUrl = 'https://api.openai.com/v1/audio/speech';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly fsrsService?: FsrsService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    this.textModel =
      this.configService.get<string>('COLLECTION_AGENTS_MODEL') ??
      this.configService.get<string>('OPENAI_SPEAKING_TEXT_MODEL') ??
      this.configService.get<string>('OPENAI_SPEAKING_MODEL') ??
      'gpt-4o-mini';
    this.audioModel =
      this.configService.get<string>('OPENAI_SPEAKING_AUDIO_MODEL') ??
      'gpt-4o-mini-audio-preview';

    const configuredVoice =
      this.configService.get<string>('OPENAI_SPEAKING_DEFAULT_VOICE') ?? 'nova';
    this.defaultVoice = this.isSpeakingVoice(configuredVoice)
      ? configuredVoice
      : 'nova';
  }

  async createReply(dto: CreateSpeakingChatDto): Promise<SpeakingChatResult> {
    this.assertApiKey();

    const messages = this.buildTextMessages(dto);

    try {
      const data = await this.callOpenAIChat({
        model: this.textModel,
        messages,
        temperature: 0.7,
      });

      const reply = data.choices?.[0]?.message?.content?.trim() ?? '';

      if (!reply) {
        throw this.createServiceError();
      }

      return {
        reply,
        model: data.model ?? this.textModel,
        usage: this.mapUsage(data),
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  async createAudioReply(
    payload: SpeakingAudioChatPayload,
  ): Promise<SpeakingAudioChatResult> {
    this.assertApiKey();

    const audioBase64 = payload.audioBuffer.toString('base64');
    const history = payload.history ?? [];
    const voice = payload.voice ?? this.defaultVoice;
    const messages = this.buildAudioMessages({
      history,
      currentAudioBase64: audioBase64,
      systemPrompt: payload.systemPrompt,
      memory: payload.memory,
    });

    try {
      const data = await this.callOpenAIChat({
        model: this.audioModel,
        modalities: ['text', 'audio'],
        audio: { voice, format: 'wav' },
        messages,
        tools: payload.autoMemoryEnabled ? [UPDATE_MEMORY_TOOL] : undefined,
      });

      const message = data.choices?.[0]?.message;
      const transcript =
        message?.audio?.transcript?.trim() ?? message?.content?.trim() ?? '';
      const responseAudioBase64 = message?.audio?.data ?? '';

      if (!transcript || !responseAudioBase64) {
        throw this.createServiceError();
      }

      return {
        transcript,
        audioBase64: responseAudioBase64,
        model: data.model ?? this.audioModel,
        usage: this.mapUsage(data),
        memoryUpdate: this.extractMemoryUpdate(message?.tool_calls),
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  async summarizeConversation(
    history: SpeakingChatHistoryItemDto[],
  ): Promise<SpeakingSummaryResult> {
    this.assertApiKey();

    const messages = this.buildAudioMessages({
      history,
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      currentTextInput: SUMMARIZE_PROMPT,
    });

    try {
      const data = await this.callOpenAIChat({
        model: this.audioModel,
        modalities: ['text'],
        messages,
        temperature: 0.2,
      });

      const content = data.choices?.[0]?.message?.content?.trim() ?? '';
      const parsed = this.parseSummaryPayload(content);

      return {
        title: parsed.title,
        summary: parsed.summary,
        usage: this.mapUsage(data),
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  async translateToTraditionalChinese(
    text: string,
  ): Promise<SpeakingTranslateResult> {
    this.assertApiKey();

    try {
      const data = await this.callOpenAIChat({
        model: this.textModel,
        messages: [
          { role: 'system', content: TRANSLATE_PROMPT },
          { role: 'user', content: text },
        ],
      });

      const translatedText = data.choices?.[0]?.message?.content?.trim() ?? '';

      if (!translatedText) {
        throw this.createServiceError();
      }

      return { translatedText };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  async chatAssistant(
    dto: SpeakingAssistantChatDto,
    userId?: string,
  ): Promise<SpeakingAssistantChatResult> {
    this.assertApiKey();

    try {
      const input: Array<Record<string, unknown>> = [
        { role: 'system', content: ASSISTANT_CHAT_SYSTEM_PROMPT },
        ...(dto.history ?? []).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        { role: 'user', content: dto.message },
      ];
      const tools =
        userId && this.prisma && this.fsrsService
          ? ASSISTANT_RESPONSES_TOOLS
          : undefined;
      const usedToolCalls: SpeakingAssistantToolCall[] = [];
      const reasoningEffort = this.toOpenAiReasoningEffort(dto.effort);
      let data = await this.callOpenAIResponses({
        model: this.textModel,
        input,
        ...(tools ? { tools } : {}),
        reasoning: { effort: reasoningEffort },
      });

      for (let round = 0; round < 3; round += 1) {
        const toolCalls = data.output?.filter(
          (item) => item.type === 'function_call' && item.name && item.call_id,
        );

        if (!toolCalls?.length || !userId) {
          break;
        }

        input.push(
          ...(data.output ?? []).map(
            (item) => item as unknown as Record<string, unknown>,
          ),
        );

        for (const toolCall of toolCalls) {
          const toolName = toolCall.name ?? '';
          if (toolName) usedToolCalls.push({ name: toolName });
          const toolResult = await this.executeVocabularyTool(
            toolName,
            toolCall.arguments ?? '{}',
            userId,
          );
          input.push({
            type: 'function_call_output',
            call_id: toolCall.call_id ?? `tool-${round}-${toolName}`,
            output: toolResult,
          });
        }

        data = await this.callOpenAIResponses({
          model: this.textModel,
          input,
          ...(tools ? { tools } : {}),
          reasoning: { effort: reasoningEffort },
        });
      }

      const reply = this.extractResponsesText(data);

      if (!reply) {
        throw this.createServiceError();
      }

      return {
        reply,
        model: data.model ?? this.textModel,
        usage: this.mapResponsesUsage(data),
        toolCalls: usedToolCalls,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  async chatAssistantStream(
    dto: SpeakingAssistantChatDto,
    userId: string | undefined,
    onEvent: (event: SpeakingAssistantStreamEvent) => void,
  ): Promise<SpeakingAssistantChatResult> {
    this.assertApiKey();

    try {
      const input: Array<Record<string, unknown>> = [
        { role: 'system', content: ASSISTANT_CHAT_SYSTEM_PROMPT },
        ...(dto.history ?? []).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        { role: 'user', content: dto.message },
      ];
      const tools =
        userId && this.prisma && this.fsrsService
          ? ASSISTANT_RESPONSES_TOOLS
          : undefined;
      const reasoningEffort = this.toOpenAiReasoningEffort(dto.effort);
      const usedToolCalls: SpeakingAssistantToolCall[] = [];
      let reply = '';
      let data = await this.callOpenAIResponsesStream(
        {
          model: this.textModel,
          input,
          ...(tools ? { tools } : {}),
          reasoning: { effort: reasoningEffort },
        },
        (delta) => {
          reply += delta;
          onEvent({ type: 'text_delta', delta });
        },
      );

      for (let round = 0; round < 3; round += 1) {
        const toolCalls = data.response.output?.filter(
          (item) => item.type === 'function_call' && item.name && item.call_id,
        );

        if (!toolCalls?.length || !userId) {
          break;
        }

        input.push(
          ...(data.response.output ?? []).map(
            (item) => item as unknown as Record<string, unknown>,
          ),
        );

        for (const toolCall of toolCalls) {
          const callId = toolCall.call_id!;
          const toolName = toolCall.name!;
          const rawArguments = toolCall.arguments ?? '{}';
          const call: SpeakingAssistantToolCall = {
            callId,
            name: toolName,
            arguments: rawArguments,
          };
          usedToolCalls.push(call);
          onEvent({
            type: 'tool_call',
            callId,
            name: toolName,
            arguments: rawArguments,
          });

          const toolResult = await this.executeVocabularyTool(
            toolName,
            rawArguments,
            userId,
          );
          let parsedResult: unknown = toolResult;
          try {
            parsedResult = JSON.parse(toolResult);
          } catch {
            // Keep the raw result when a tool returns non-JSON text.
          }
          call.result = parsedResult;
          onEvent({
            type: 'tool_result',
            callId,
            name: toolName,
            result: parsedResult,
          });
          input.push({
            type: 'function_call_output',
            call_id: callId,
            output: toolResult,
          });
        }

        data = await this.callOpenAIResponsesStream(
          {
            model: this.textModel,
            input,
            ...(tools ? { tools } : {}),
            reasoning: { effort: reasoningEffort },
          },
          (delta) => {
            reply += delta;
            onEvent({ type: 'text_delta', delta });
          },
        );
      }

      if (!reply) {
        reply = this.extractResponsesText(data.response);
        if (reply) onEvent({ type: 'text_delta', delta: reply });
      }

      if (!reply.trim()) {
        throw this.createServiceError();
      }

      return {
        reply: reply.trim(),
        model: data.response.model ?? this.textModel,
        usage: this.mapResponsesUsage(data.response),
        toolCalls: usedToolCalls,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  private toOpenAiReasoningEffort(
    effort?: SpeakingAssistantEffort,
  ): SpeakingAssistantEffort {
    return effort ?? 'none';
  }

  private async executeVocabularyTool(
    name: string,
    rawArguments: string,
    userId: string,
  ): Promise<string> {
    if (!this.prisma || !this.fsrsService) {
      return JSON.stringify({ error: 'vocabulary tools are unavailable' });
    }

    let args: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawArguments) as unknown;
      args =
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      return JSON.stringify({ error: 'invalid tool arguments' });
    }

    try {
      if (name === 'search_user_vocabulary') {
        return JSON.stringify(await this.searchUserVocabulary(userId, args));
      }

      if (name === 'get_word_proficiency') {
        return JSON.stringify(await this.getWordProficiency(userId, args));
      }

      return JSON.stringify({ error: `unknown tool: ${name}` });
    } catch {
      return JSON.stringify({ error: 'vocabulary lookup failed' });
    }
  }

  private async searchUserVocabulary(
    userId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return { query, results: [], error: 'query is required' };
    }

    const requestedLimit = typeof args.limit === 'number' ? args.limit : 5;
    const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 10);
    const cards = await this.prisma!.card.findMany({
      where: {
        deck: { userId },
        OR: [
          { front: { contains: query, mode: 'insensitive' } },
          {
            meanings: {
              some: { zhMeaning: { contains: query, mode: 'insensitive' } },
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        deck: { select: { name: true } },
        meanings: { orderBy: { sortOrder: 'asc' }, take: 3 },
      },
    });

    return {
      query,
      results: cards.map((card) => this.serializeVocabularyCard(card)),
    };
  }

  private async getWordProficiency(
    userId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const word = typeof args.word === 'string' ? args.word.trim() : '';
    if (!word) {
      return { word, found: false, error: 'word is required' };
    }

    const cards = await this.prisma!.card.findMany({
      where: {
        deck: { userId },
        front: { equals: word, mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        deck: { select: { name: true } },
        meanings: { orderBy: { sortOrder: 'asc' }, take: 3 },
      },
    });

    return {
      word,
      found: cards.length > 0,
      results: cards.map((card) => this.serializeVocabularyCard(card)),
    };
  }

  private serializeVocabularyCard(card: {
    front: string;
    state: CardScheduleState['state'];
    due: Date | null;
    stability: number | null;
    difficulty: number | null;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    lastReview: Date | null;
    learningStep: number;
    reverseState: CardScheduleState['state'];
    reverseDue: Date | null;
    reverseStability: number | null;
    reverseDifficulty: number | null;
    reverseElapsedDays: number;
    reverseScheduledDays: number;
    reverseReps: number;
    reverseLapses: number;
    reverseLastReview: Date | null;
    reverseLearningStep: number;
    deck: { name: string };
    meanings: Array<{ zhMeaning: string; enExample: string | null }>;
  }): Record<string, unknown> {
    return {
      word: card.front,
      deck: card.deck.name,
      meanings: card.meanings.map((meaning) => meaning.zhMeaning),
      examples: card.meanings
        .map((meaning) => meaning.enExample)
        .filter((example): example is string => Boolean(example)),
      forward: this.serializeVocabularyProgress({
        state: card.state,
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsedDays: card.elapsedDays,
        scheduledDays: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        lastReview: card.lastReview,
        learningStep: card.learningStep,
      }),
      reverse: this.serializeVocabularyProgress({
        state: card.reverseState,
        due: card.reverseDue,
        stability: card.reverseStability,
        difficulty: card.reverseDifficulty,
        elapsedDays: card.reverseElapsedDays,
        scheduledDays: card.reverseScheduledDays,
        reps: card.reverseReps,
        lapses: card.reverseLapses,
        lastReview: card.reverseLastReview,
        learningStep: card.reverseLearningStep,
      }),
    };
  }

  private serializeVocabularyProgress(
    state: CardScheduleState,
  ): Record<string, unknown> {
    const retrievability = this.fsrsService!.calculateRetrievability(state);
    return {
      state: state.state,
      proficiency: this.fsrsService!.calculateProficiency(state),
      retrievabilityPercent:
        retrievability === null ? null : Math.round(retrievability * 100),
      due: state.due?.toISOString() ?? null,
      reps: state.reps,
      lapses: state.lapses,
      lastReview: state.lastReview?.toISOString() ?? null,
    };
  }

  async previewVoice(
    voice?: SpeakingVoice,
  ): Promise<SpeakingVoicePreviewResult> {
    this.assertApiKey();

    const targetVoice = voice ?? this.defaultVoice;

    try {
      const response = await fetch(this.speechUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: targetVoice,
          input: "Hi there! I'm excited to practice English with you today.",
          response_format: 'mp3',
        } satisfies OpenAISpeechRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          'Speaking voice preview API error:',
          response.status,
          errorText,
        );
        throw this.createServiceError();
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return { audioBase64: buffer.toString('base64') };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw this.createServiceError();
    }
  }

  private assertApiKey(): void {
    if (!this.apiKey) {
      throw this.createServiceError();
    }
  }

  private isSpeakingVoice(value: string): value is SpeakingVoice {
    return (SPEAKING_VOICES as readonly string[]).includes(value);
  }

  private buildTextMessages(dto: CreateSpeakingChatDto): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    const prompt = dto.systemPrompt?.trim() || DEFAULT_SPEAKING_PROMPT;
    const history = (dto.history ?? []).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    return [
      { role: 'system', content: prompt },
      ...history,
      { role: 'user', content: dto.message },
    ];
  }

  private buildAudioMessages(input: {
    history: SpeakingChatHistoryItemDto[];
    currentAudioBase64?: string;
    currentTextInput?: string;
    systemPrompt?: string;
    memory?: string;
  }): Array<Record<string, unknown>> {
    const prompt = this.buildSystemPrompt(input.systemPrompt, input.memory);

    const historyMessages: Array<Record<string, unknown>> = [];

    for (const item of input.history) {
      if (item.role === 'user' && item.audioBase64) {
        const audioContent = this.createWavInputAudioContent(item.audioBase64);
        if (!audioContent) {
          if (item.text?.trim()) {
            historyMessages.push({ role: 'user', content: item.text.trim() });
          }
          continue;
        }

        historyMessages.push({
          role: 'user',
          content: [audioContent],
        });
        continue;
      }

      if (item.role === 'assistant' && item.text) {
        historyMessages.push({ role: 'assistant', content: item.text });
        continue;
      }

      if (item.role === 'user' && item.text) {
        historyMessages.push({ role: 'user', content: item.text });
      }
    }

    const currentMessage = input.currentAudioBase64
      ? (() => {
          const audioContent = this.createWavInputAudioContent(
            input.currentAudioBase64,
          );
          if (!audioContent) {
            return {
              role: 'user',
              content: input.currentTextInput ?? '',
            };
          }

          return {
            role: 'user',
            content: [audioContent],
          };
        })()
      : {
          role: 'user',
          content: input.currentTextInput ?? '',
        };

    return [
      { role: 'system', content: prompt },
      ...historyMessages,
      currentMessage,
    ];
  }

  private createWavInputAudioContent(rawAudioBase64: string): {
    type: 'input_audio';
    input_audio: { data: string; format: 'wav' };
  } | null {
    const normalized = this.normalizeBase64(rawAudioBase64);
    if (!normalized || !normalized.startsWith('UklGR')) {
      return null;
    }

    return {
      type: 'input_audio',
      input_audio: {
        data: normalized,
        format: 'wav',
      },
    };
  }

  private normalizeBase64(rawValue: string): string {
    const trimmed = rawValue.trim();
    const marker = 'base64,';
    const markerIndex = trimmed.indexOf(marker);

    if (markerIndex >= 0) {
      return trimmed.slice(markerIndex + marker.length);
    }

    return trimmed;
  }

  private buildSystemPrompt(systemPrompt?: string, memory?: string): string {
    const basePrompt = systemPrompt?.trim() || DEFAULT_SPEAKING_PROMPT;
    const trimmedMemory = memory?.trim();

    if (!trimmedMemory) {
      return basePrompt;
    }

    return `${basePrompt}\n\nLong-term memory about this user:\n${trimmedMemory}`;
  }

  private async callOpenAIChat(
    payload: Record<string, unknown>,
  ): Promise<OpenAIChatResponse> {
    const response = await fetch(this.chatCompletionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Speaking OpenAI API error:', response.status, errorText);
      throw this.createServiceError();
    }

    return (await response.json()) as OpenAIChatResponse;
  }

  private async callOpenAIResponses(
    payload: Record<string, unknown>,
  ): Promise<OpenAIResponsesResponse> {
    const response = await fetch(this.responsesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Speaking OpenAI API error:', response.status, errorText);
      throw this.createServiceError();
    }

    return (await response.json()) as OpenAIResponsesResponse;
  }

  private async callOpenAIResponsesStream(
    payload: Record<string, unknown>,
    onTextDelta: (delta: string) => void,
  ): Promise<{ response: OpenAIResponsesResponse }> {
    const response = await fetch(this.responsesUrl, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error('Speaking OpenAI API error:', response.status, errorText);
      throw this.createServiceError();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completedResponse: OpenAIResponsesResponse | undefined;

    const consumeEvent = (eventText: string) => {
      const dataLine = eventText
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join('\n');
      if (!dataLine || dataLine === '[DONE]') return;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        return;
      }

      const eventType =
        typeof event.type === 'string'
          ? event.type
          : eventText
              .split('\n')
              .find((line) => line.startsWith('event:'))
              ?.slice('event:'.length)
              .trim();

      if (eventType === 'response.output_text.delta') {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (delta) onTextDelta(delta);
      } else if (eventType === 'response.completed') {
        completedResponse = event.response as OpenAIResponsesResponse;
      } else if (eventType === 'response.failed') {
        throw this.createServiceError();
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const eventText of events) consumeEvent(eventText);
      if (done) break;
    }

    if (buffer.trim()) consumeEvent(buffer);
    if (!completedResponse) {
      throw this.createServiceError();
    }

    return { response: completedResponse };
  }

  private extractResponsesText(response: OpenAIResponsesResponse): string {
    if (typeof response.output_text === 'string') {
      return response.output_text.trim();
    }

    return (response.output ?? [])
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter(
        (content) => content.type === 'output_text' || content.type === 'text',
      )
      .map((content) => content.text ?? '')
      .join('\n')
      .trim();
  }

  private mapResponsesUsage(
    response: OpenAIResponsesResponse,
  ): SpeakingTokenUsage {
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
      promptTextTokens: inputTokens,
      promptAudioTokens: 0,
      completionTextTokens: outputTokens,
      completionAudioTokens: 0,
    };
  }

  private mapUsage(response: OpenAIChatResponse): SpeakingTokenUsage {
    return {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
      promptTextTokens: response.usage?.prompt_tokens_details?.text_tokens ?? 0,
      promptAudioTokens:
        response.usage?.prompt_tokens_details?.audio_tokens ?? 0,
      completionTextTokens:
        response.usage?.completion_tokens_details?.text_tokens ?? 0,
      completionAudioTokens:
        response.usage?.completion_tokens_details?.audio_tokens ?? 0,
    };
  }

  private extractMemoryUpdate(
    toolCalls: OpenAIChatToolCall[] | undefined,
  ): { memory: string; reason?: string } | undefined {
    if (!toolCalls) {
      return undefined;
    }

    for (const call of toolCalls) {
      if (call.type !== 'function' || call.function?.name !== 'update_memory') {
        continue;
      }

      try {
        const parsed = JSON.parse(call.function.arguments ?? '{}') as {
          memory?: string;
          reason?: string;
        };

        const memory = parsed.memory?.trim();
        if (!memory) {
          continue;
        }

        return {
          memory: memory.slice(0, 1200),
          reason: parsed.reason?.trim(),
        };
      } catch {
        // ignore malformed tool arguments
      }
    }

    return undefined;
  }

  private parseSummaryPayload(raw: string): { title: string; summary: string } {
    const text = raw.trim();
    if (!text) {
      return { title: '本次英語練習', summary: '' };
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as {
          title?: string;
          summary?: string;
        };
        const summary = parsed.summary?.trim() || '';
        const title =
          this.cleanSummaryTitle(parsed.title?.trim() || '') ||
          this.deriveSummaryTitle(summary);

        return {
          title,
          summary: summary || text,
        };
      } catch {
        // fallback below
      }
    }

    return {
      title: this.deriveSummaryTitle(text),
      summary: text,
    };
  }

  private cleanSummaryTitle(raw: string): string {
    return raw
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["'「『（(【]+/, '')
      .replace(/["'」』）)】]+$/, '')
      .trim();
  }

  private deriveSummaryTitle(summary: string): string {
    const plain = summary.replace(/\s+/g, ' ').trim();
    if (!plain) {
      return '本次英語練習';
    }

    const sentence = plain.split(/[.!?]/)[0]?.trim() || plain;
    return sentence.length > 32 ? `${sentence.slice(0, 32)}...` : sentence;
  }

  private createServiceError() {
    return new InternalServerErrorException({
      error: {
        code: 'AI_SERVICE_ERROR',
        message: 'AI 服務暫時無法使用，請稍後再試',
      },
    });
  }
}
