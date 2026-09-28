import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

// 只產生資料 INSERT；D1 的資料表由 d1/migrations 建立。
// 使用 PGHOST、PGPORT、PGDATABASE 等標準 PostgreSQL 環境變數連線。
const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error(
    '用法：node scripts/export-postgres-to-d1.mjs <輸出 SQL 路徑>',
  );
}

const schemaPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../prisma/schema.prisma',
);
const tables = [
  ...readFileSync(schemaPath, 'utf8').matchAll(/^model (\w+) \{/gm),
].map((match) => match[1]);

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlValue(value, type) {
  if (value === null) return 'NULL';
  if (type === 'timestamp without time zone') {
    if (typeof value !== 'string') throw new Error('時間欄位格式不正確');
    return sqlString(new Date(`${value.replace(' ', 'T')}Z`).toISOString());
  }
  if (typeof value === 'string') return sqlString(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object') return sqlString(JSON.stringify(value));
  throw new Error(`不支援的 PostgreSQL 值型別：${typeof value}`);
}

function metadata(query) {
  const result = spawnSync(
    'psql',
    ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query],
    {
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) throw new Error('無法讀取 PostgreSQL 結構');
  return JSON.parse(result.stdout.trim());
}

const sourceTables = metadata(
  "SELECT COALESCE(json_agg(tablename ORDER BY tablename), '[]'::json) FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
);
const missing = tables.filter((table) => !sourceTables.includes(table));
const extra = sourceTables.filter((table) => !tables.includes(table));
if (missing.length || extra.length) {
  throw new Error(
    `備份與 Prisma schema 不一致：缺少 ${missing.join(', ') || '無'}；多出 ${extra.join(', ') || '無'}`,
  );
}

const columns = metadata(
  "SELECT COALESCE(json_object_agg(table_name, columns), '{}'::json) FROM (SELECT table_name, json_agg(json_build_object('name', column_name, 'type', data_type) ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' GROUP BY table_name) AS per_table",
);

const writer = createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
await once(writer, 'open');
const counts = {};

try {
  for (const table of tables) {
    const tableColumns = columns[table];
    if (!Array.isArray(tableColumns) || !tableColumns.length) {
      throw new Error(`無法讀取 ${table} 欄位`);
    }
    const names = tableColumns.map(({ name }) => `"${name}"`).join(', ');
    const query = `SELECT row_to_json(t)::text FROM "${table}" AS t ORDER BY id`;
    const child = spawn(
      'psql',
      ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const completion = once(child, 'close');
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    let count = 0;
    for await (const line of createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    })) {
      if (!line) continue;
      const row = JSON.parse(line);
      const values = tableColumns.map(({ name, type }) =>
        sqlValue(row[name], type),
      );
      const statement = `INSERT INTO "${table}" (${names}) VALUES (${values.join(', ')});\n`;
      if (!writer.write(statement)) await once(writer, 'drain');
      count++;
    }
    const [code] = await completion;
    if (code !== 0) throw new Error(`讀取 ${table} 失敗：${stderr.trim()}`);
    counts[table] = count;
  }
} finally {
  writer.end();
  await once(writer, 'finish');
}

writeFileSync(
  `${outputPath}.counts.json`,
  `${JSON.stringify(counts, null, 2)}\n`,
  {
    mode: 0o600,
    flag: 'wx',
  },
);
console.log(
  `已匯出 ${tables.length} 個資料表，合計 ${Object.values(counts).reduce((sum, n) => sum + n, 0)} 筆。`,
);
