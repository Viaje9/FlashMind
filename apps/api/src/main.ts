import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json, type ErrorRequestHandler } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // 文字紀錄使用獨立上限，不影響既有語音端點的 parser。
  const textPaths = [
    '/api/speaking/sessions',
    '/api/speaking/reviews',
    '/api/speaking/history-migrations',
    '/api/auth/cli/authorizations',
  ];
  app.use(
    textPaths,
    (
      _req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.use(textPaths, json({ limit: '2mb' }));
  const textParserErrors: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    next,
  ) => {
    const errorType =
      error && typeof error === 'object' && 'type' in error
        ? error.type
        : undefined;
    if (errorType === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: '文字請求超過 2 MiB 上限',
        },
      });
    } else if (errorType === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'JSON 格式錯誤' } });
    } else next(error);
  };
  app.use(textPaths, textParserErrors);
  app.useBodyParser('json', { limit: '2gb' });

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // 如果有設定 CORS_ORIGINS，使用明確的來源清單
      if (corsOrigins && corsOrigins.length > 0) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
        return;
      }

      // 開發環境：允許 localhost 與常見區網網段（http / https）
      const allowedPatterns = [
        /^https?:\/\/localhost:\d+$/,
        /^https?:\/\/127\.0\.0\.1:\d+$/,
        /^https?:\/\/\[::1\]:\d+$/,
        /^https?:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^https?:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$/,
      ];
      if (!origin || allowedPatterns.some((pattern) => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3280, '0.0.0.0');
}
void bootstrap();
