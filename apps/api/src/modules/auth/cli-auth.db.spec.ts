import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CliAuthService } from './cli-auth.service';
const url = process.env.DATABASE_URL;
const isolated =
  url && new URL(url).searchParams.get('schema') === 'speaking_cli_test';
(isolated ? describe : describe.skip)('CLI 登入授權（隔離 PostgreSQL）', () => {
  let db: PrismaClient, service: CliAuthService, userId: string;
  let ids: string[] = [];
  beforeAll(async () => {
    db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: url },
        { schema: 'speaking_cli_test' },
      ),
    });
    await db.$connect();
  });
  beforeEach(async () => {
    ids = [];
    userId = (
      await db.user.create({
        data: { email: `cli-${randomUUID()}@example.invalid` },
      })
    ).id;
    service = new CliAuthService(
      db as never,
      new ConfigService({ FRONTEND_URL: 'http://localhost:4280' }),
    );
  });
  afterEach(async () => {
    await db.cliLoginAuthorization.deleteMany({ where: { id: { in: ids } } });
    await db.user.delete({ where: { id: userId } });
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  async function start() {
    const verifier = randomBytes(32).toString('base64url');
    const started = await service.create(
      { verifierHash: createHash('sha256').update(verifier).digest('hex') },
      'test-client',
    );
    ids.push(started.authorizationId);
    return { ...started, verifier };
  }
  it('只有發起端能單次兌換 30 日 session，回應期限與 DB 一致', async () => {
    const value = await start();
    expect(
      (
        await service.exchange(
          value.authorizationId,
          { verifier: value.verifier },
          'test-client',
        )
      ).data.status,
    ).toBe('pending');
    await expect(
      service.exchange(
        value.authorizationId,
        { verifier: 'x'.repeat(43) },
        'test-client',
      ),
    ).rejects.toMatchObject({ status: 404 });
    await service.approve(
      userId,
      value.authorizationId,
      {
        expectedUserId: userId,
        pairingCode: value.pairingCode,
        decision: 'approve',
      },
      'http://localhost:4280',
    );
    const exchangedAt = Date.now();
    const result = await service.exchange(
      value.authorizationId,
      { verifier: value.verifier },
      'test-client',
    );
    expect(result.data.userId).toBe(userId);
    expect(result.session?.token).toBeTruthy();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(result.session!.expiresAt.getTime()).toBeGreaterThanOrEqual(
      exchangedAt + thirtyDays,
    );
    expect(result.session!.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + thirtyDays,
    );
    const stored = await db.session.findUniqueOrThrow({
      where: { token: result.session!.token },
    });
    expect(result.data.expiresAt).toBe(stored.expiresAt.toISOString());
    expect(result.session!.expiresAt).toEqual(stored.expiresAt);
    expect(JSON.stringify(result.data)).not.toContain(result.session!.token);
    await expect(
      service.exchange(
        value.authorizationId,
        { verifier: value.verifier },
        'test-client',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.session.count({ where: { userId } })).toBe(1);
  });
  it('拒絕不可信 Origin、沒有 Origin 與錯誤配對碼', async () => {
    const value = await start();
    for (const origin of [undefined, 'https://attacker.example'])
      await expect(
        service.approve(
          userId,
          value.authorizationId,
          {
            expectedUserId: userId,
            pairingCode: value.pairingCode,
            decision: 'approve',
          },
          origin,
        ),
      ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.approve(
        userId,
        value.authorizationId,
        { expectedUserId: userId, pairingCode: 'wrong', decision: 'approve' },
        'http://localhost:4280',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(await db.session.count({ where: { userId } })).toBe(0);
  });
  it('拒絕與過期授權不建立 session', async () => {
    const denied = await start();
    await service.approve(
      userId,
      denied.authorizationId,
      {
        expectedUserId: userId,
        pairingCode: denied.pairingCode,
        decision: 'deny',
      },
      'http://localhost:4280',
    );
    expect(
      (
        await service.exchange(
          denied.authorizationId,
          { verifier: denied.verifier },
          'test-client',
        )
      ).data.status,
    ).toBe('denied');
    const expired = await start();
    await db.cliLoginAuthorization.update({
      where: { id: expired.authorizationId },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      service.exchange(
        expired.authorizationId,
        { verifier: expired.verifier },
        'test-client',
      ),
    ).rejects.toMatchObject({ status: 410 });
    expect(await db.session.count({ where: { userId } })).toBe(0);
  });
  it('並行兌換只發出一個 session', async () => {
    const value = await start();
    await service.approve(
      userId,
      value.authorizationId,
      {
        expectedUserId: userId,
        pairingCode: value.pairingCode,
        decision: 'approve',
      },
      'http://localhost:4280',
    );
    const results = await Promise.allSettled([
      service.exchange(
        value.authorizationId,
        { verifier: value.verifier },
        'test-client',
      ),
      service.exchange(
        value.authorizationId,
        { verifier: value.verifier },
        'test-client',
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.session.count({ where: { userId } })).toBe(1);
  });
  it('限制單一來源短時間大量建立授權', async () => {
    for (let i = 0; i < 10; i++) await start();
    await expect(start()).rejects.toMatchObject({ status: 429 });
  });
});
