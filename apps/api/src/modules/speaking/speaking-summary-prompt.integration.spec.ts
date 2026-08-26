import { ConfigService } from '@nestjs/config';
import { SpeakingService } from './speaking.service';

const runLivePromptEval = process.env['RUN_OPENAI_PROMPT_EVAL'] === '1';
const describeLive = runLivePromptEval ? describe : describe.skip;

describeLive('Speaking summary prompt live eval', () => {
  jest.setTimeout(120_000);

  it('使用者只說 website 時，不應把 site 判定為 actual use', async () => {
    const targetVocabularyService = {
      listReviewCandidates: jest.fn().mockResolvedValue([
        {
          term: 'site',
          normalizedTerm: 'site',
          zhMeaning: '站點',
          status: 'UNSEEN',
        },
      ]),
      applyReview: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string) => process.env[key]),
    } as unknown as ConfigService;
    const service = new SpeakingService(
      configService,
      undefined,
      undefined,
      targetVocabularyService as never,
    );

    const attempts = 5;
    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        service.summarizeConversation(
          [
            {
              role: 'user',
              text: "Today I'm building a website.",
            },
            {
              role: 'assistant',
              text: 'That sounds interesting. What are you building?',
            },
          ],
          'prompt-eval-user',
        ),
      ),
    );

    const falsePositives = results.filter((result) =>
      result.actualUses.some((item) => item.term === 'site'),
    );

    console.info(
      `[prompt-eval] site false positives: ${falsePositives.length}/${attempts}`,
      results.map((result) => ({
        actualUses: result.actualUses.map((item) => item.term),
        recommendations: result.recommendations.map((item) => item.term),
      })),
    );

    expect(falsePositives).toHaveLength(0);
  });
});
