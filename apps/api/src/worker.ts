import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import { z } from 'zod';
import { AuthError, AuthService } from './worker/auth.service';
import { ApiError } from './worker/errors';
import { D1AuthStore } from './worker/auth.store';
import { DeckService } from './worker/deck.service';
import { D1DeckStore } from './worker/deck.store';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  OPENAI_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
const loginSchema = registerSchema.extend({
  rememberMe: z.boolean().optional(),
});
const learningStepsSchema = z.string().refine((value) => {
  const steps = value
    .trim()
    .split(',')
    .map((step) => step.trim());
  return steps.every(
    (step) => /^\d+[mhd]$/.test(step) && Number.parseInt(step, 10) > 0,
  );
});

function auth(db: D1Database): AuthService {
  return new AuthService(new D1AuthStore(db));
}

async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (Number(request.headers.get('content-length')) > 16 * 1024) {
    throw new AuthError('VALIDATION_ERROR', '請求內容過大', 400);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AuthError('INVALID_JSON', 'JSON 格式錯誤', 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AuthError('VALIDATION_ERROR', '輸入資料格式錯誤', 400);
  }
  return result.data;
}

function cookieOptions(requestUrl: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: new URL(requestUrl).protocol === 'https:',
    sameSite: 'Strict' as const,
    path: '/',
    maxAge,
  };
}

app.get('/api/health', async (context) => {
  await context.env.DB.prepare('SELECT 1').first();
  return context.json({ data: { status: 'ok' } });
});

app.post('/api/auth/register', async (context) => {
  const input = await parseBody(context.req.raw, registerSchema);
  const result = await auth(context.env.DB).register(input);
  setCookie(
    context,
    'session',
    result.token,
    cookieOptions(context.req.url, 24 * 60 * 60),
  );
  context.header('Cache-Control', 'no-store');
  return context.json(result.user, 201);
});

app.post('/api/auth/login', async (context) => {
  const input = await parseBody(context.req.raw, loginSchema);
  const result = await auth(context.env.DB).login(input);
  setCookie(
    context,
    'session',
    result.token,
    cookieOptions(
      context.req.url,
      input.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    ),
  );
  context.header('Cache-Control', 'no-store');
  return context.json(result.user);
});

app.get('/api/auth/me', async (context) => {
  const result = await auth(context.env.DB).currentUser(
    getCookie(context, 'session'),
  );
  context.header('Cache-Control', 'no-store');
  return context.json(result);
});

app.post('/api/auth/logout', async (context) => {
  await auth(context.env.DB).logout(getCookie(context, 'session'));
  deleteCookie(context, 'session', cookieOptions(context.req.url, 0));
  context.header('Cache-Control', 'no-store');
  return context.body(null, 204);
});

app.get('/api/decks', async (context) => {
  const user = await auth(context.env.DB).authenticate(
    getCookie(context, 'session'),
  );
  const decks = await new DeckService(new D1DeckStore(context.env.DB)).list(
    user.id,
    user.timezone,
  );
  context.header('Cache-Control', 'no-store');
  return context.json({ data: decks });
});

app.post('/api/decks', async (context) => {
  const user = await auth(context.env.DB).authenticate(
    getCookie(context, 'session'),
  );
  const input = await parseBody(
    context.req.raw,
    z.object({
      name: z.string().min(1).max(100),
      dailyNewCards: z.number().int().min(5).max(100).optional(),
      dailyReviewCards: z.number().int().min(10).max(500).optional(),
      dailyResetHour: z.number().int().min(0).max(23).optional(),
      learningSteps: learningStepsSchema.optional(),
      relearningSteps: learningStepsSchema.optional(),
      requestRetention: z.number().min(0.7).max(0.97).optional(),
      maximumInterval: z.number().int().min(30).max(36500).optional(),
      enableReverse: z.boolean().optional(),
    }),
  );
  const result = await new DeckService(new D1DeckStore(context.env.DB)).create(
    user.id,
    input,
  );
  context.header('Cache-Control', 'no-store');
  return context.json(result, 201);
});

app.get('/api/decks/:id', async (context) => {
  const user = await auth(context.env.DB).authenticate(
    getCookie(context, 'session'),
  );
  const deck = await new DeckService(new D1DeckStore(context.env.DB)).get(
    context.req.param('id'),
    user.id,
  );
  context.header('Cache-Control', 'no-store');
  return context.json({ data: deck });
});

app.notFound((context) =>
  context.json({ error: { code: 'NOT_FOUND', message: '找不到資源' } }, 404),
);

app.onError((error, context) => {
  if (error instanceof ApiError) {
    return context.json(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }
  console.error('[flashmind-worker]', error);
  return context.json(
    { error: { code: 'INTERNAL_ERROR', message: '伺服器發生錯誤' } },
    500,
  );
});

export default app;
