// E2E 專用 Summary 模型替身：僅允許隔離 schema，不取得任何 AI 憑證或連外。
if (
  process.env.NODE_ENV !== 'test' ||
  new URL(process.env.DATABASE_URL).searchParams.get('schema') !==
    'speaking_cli_test'
)
  throw new Error('禁止在一般環境載入 E2E 模型替身');
const {
  SpeakingService,
} = require('../dist/modules/speaking/speaking.service');
SpeakingService.prototype.assertApiKey = function () {};
SpeakingService.prototype.callOpenAIChat = async function (input) {
  if (
    !input.messages.some(
      (message) =>
        typeof message.content === 'string' &&
        message.content.includes(
          'You are reviewing an English speaking practice',
        ),
    )
  )
    throw new Error('E2E 只允許 Summary 模型替身');
  const original = input.messages.find((message) => message.role === 'user');
  const match = /^\[messageId: (.+?)\]\n([\s\S]*)$/.exec(
    original?.content ?? '',
  );
  const text = match?.[2] ?? 'I walk in the park on weekends.';
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: '測試摘要',
            summary: text,
            review: '表達清楚。',
            actualUses:
              match && /\bwalk\b/.test(text)
                ? [
                    {
                      term: 'walk',
                      expressionContext: '描述散步習慣',
                      naturalSentence: text,
                      evidence: [{ messageId: match[1], quote: text }],
                    },
                  ]
                : [],
            recommendations: [],
            nextPractice: {
              topic: 'Weekend routines',
              speakingGoal: 'Describe a weekend.',
              guidingQuestions: [],
              recallTargets: ['walk'],
            },
          }),
        },
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
};
