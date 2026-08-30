// 僅使用明確隔離的 schema；不讀取或修改既有 AI 金鑰。
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
const root = path.resolve(__dirname, '../../..');
process.loadEnvFile(path.join(root, 'apps/api/.env.speaking-test'));
if (
  new URL(process.env.DATABASE_URL).searchParams.get('schema') !==
  'speaking_cli_test'
)
  throw new Error('拒絕在非隔離 schema 執行');

async function run() {
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: process.env.DATABASE_URL },
      { schema: 'speaking_cli_test' },
    ),
  });
  const accountsPath = path.join(root, 'e2e/.auth/test-accounts.json');
  await fs.mkdir(path.dirname(accountsPath), { recursive: true });
  let accounts = {};
  try {
    accounts = JSON.parse(await fs.readFile(accountsPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const userIds = [];
  for (const [index, name] of [
    'speakingCliTestUser',
    'speakingCliOtherUser',
    'speakingCliDeniedUser',
  ].entries()) {
    const account = accounts[name] ?? {
      email: `speaking-cli-e2e-${index}@example.invalid`,
      password: randomBytes(24).toString('base64url'),
    };
    if (!account.email.endsWith('@example.invalid'))
      throw new Error('拒絕使用非測試帳號');
    await db.user.deleteMany({ where: { email: account.email } });
    const user = await db.user.create({
      data: {
        email: account.email,
        passwordHash: await bcrypt.hash(account.password, 10),
      },
    });
    accounts[name] = { ...account, userId: user.id };
    userIds.push(user.id);
    if (index === 0) {
      for (const [offset, status] of [
        'UNSEEN',
        'PRACTICING',
        'USED',
        'ADDED',
      ].entries()) {
        const term = ['walk', 'cooperation', 'function', 'improve'][offset];
        await db.targetVocabulary.create({
          data: {
            userId: user.id,
            term,
            normalizedTerm: term,
            zhMeaning: ['散步', '合作', '功能', '改善'][offset],
            status,
          },
        });
      }
    }
  }
  await db.$disconnect();
  await fs.writeFile(accountsPath, JSON.stringify(accounts, null, 2) + '\n', {
    mode: 0o600,
  });
  await fs.chmod(accountsPath, 0o600);
  const api = spawn(
    process.execPath,
    [
      '--require',
      path.join(root, 'apps/api/test/speaking-e2e-ai.cjs'),
      path.join(root, 'apps/api/dist/main.js'),
    ],
    {
      cwd: path.join(root, 'apps/api'),
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        PORT: '4381',
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:4380',
        PUBLIC_API_ORIGIN: 'http://localhost:4381',
        CORS_ORIGINS: 'http://localhost:4380,http://localhost:4382',
        WHITELIST_ENABLED: 'true',
        WHITELIST_USER_IDS: userIds.slice(0, 2).join(','),
        OPENAI_API_KEY: '',
        ZEABUR_API_KEY: '',
      },
    },
  );
  api.stderr.on('data', () => {});
  const webRoot = path.join(root, 'apps/web/dist/web/browser');
  const web = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: 4381,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      );
      let file = path.resolve(webRoot, '.' + pathname);
      if (!file.startsWith(webRoot + path.sep))
        file = path.join(webRoot, 'index.html');
      try {
        if (!(await fs.stat(file)).isFile())
          file = path.join(webRoot, 'index.html');
      } catch {
        file = path.join(webRoot, 'index.html');
      }
      const type =
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
        }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      web.once('error', reject);
      web.listen(4380, '127.0.0.1', resolve);
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (api.exitCode !== null) throw new Error('隔離 API 啟動失敗');
      try {
        ready =
          (await fetch('http://localhost:4381/api/auth/me')).status === 401;
      } catch {}
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error('隔離 API 未就緒');
    console.log(
      'E2E：localhost:4380 / 4381，schema=speaking_cli_test，AI 使用隔離測試替身。',
    );
    const test = spawn(
      path.join(root, 'e2e/node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.speaking.config.ts',
        ...process.argv.slice(2),
      ],
      {
        cwd: path.join(root, 'e2e'),
        stdio: 'inherit',
        env: { ...process.env, SPEAKING_ISOLATED_E2E: 'true' },
      },
    );
    process.exitCode = await new Promise((resolve) =>
      test.on('exit', (code) => resolve(code ?? 1)),
    );
  } finally {
    web.closeAllConnections();
    await new Promise((resolve) => web.close(resolve));
    api.kill('SIGTERM');
  }
}
run().catch(() => {
  console.error(
    '隔離 E2E 未完成；請確認專用 .env.speaking-test、資料庫 migration 和本機 4380／4381 port。',
  );
  process.exitCode = 1;
});
