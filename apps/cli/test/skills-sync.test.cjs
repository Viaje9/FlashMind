const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const cliRoot = path.resolve(__dirname, "..");
const sync = path.join(cliRoot, "scripts/sync-skills.mjs");
const names = ["flashmind-practice", "flashmind-review"];

async function setup(t) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "flashmind skills sync-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, "global skills");
  const run = (...args) =>
    spawnSync(process.execPath, [sync, "--target-dir", target, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  return { root, target, run };
}

test("dry-run 與錯誤選項不建立全域目錄", async (t) => {
  const { target, run } = await setup(t);
  assert.equal(run("--dry-run").status, 0);
  await assert.rejects(fs.lstat(target), { code: "ENOENT" });
  assert.notEqual(run("--unknown").status, 0);
  assert.notEqual(run("--target-dir").status, 0);
  await assert.rejects(fs.lstat(target), { code: "ENOENT" });
});

test("同步及更新兩個 skill，保留其他 skill，從有空白的外部目錄執行 CLI", async (t) => {
  const { root, target, run } = await setup(t);
  const unrelated = path.join(target, "english-study-review", "SKILL.md");
  await fs.mkdir(path.dirname(unrelated), { recursive: true });
  await fs.writeFile(unrelated, "原本的 English Study，不得修改");
  assert.equal(run().status, 0);
  for (const name of names) {
    assert.equal(
      await fs.readFile(path.join(target, name, "SKILL.md"), "utf8"),
      await fs.readFile(path.join(cliRoot, "skills", name, "SKILL.md"), "utf8"),
    );
    const result = spawnSync(
      process.execPath,
      [path.join(target, name, "scripts/flashmind.cjs"), "--help"],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /flashmind practice context/);
    assert.match(result.stdout, /flashmind review save/);
  }
  const stale = path.join(target, names[0], "removed-resource.txt");
  await fs.writeFile(stale, "舊版已不使用的資源");
  await fs.writeFile(path.join(target, names[0], "SKILL.md"), "過期副本");
  assert.equal(run().status, 0);
  await assert.rejects(fs.lstat(stale), { code: "ENOENT" });
  assert.equal(
    await fs.readFile(path.join(target, names[0], "SKILL.md"), "utf8"),
    await fs.readFile(
      path.join(cliRoot, "skills", names[0], "SKILL.md"),
      "utf8",
    ),
  );
  assert.equal(
    await fs.readFile(unrelated, "utf8"),
    "原本的 English Study，不得修改",
  );
  assert.deepEqual(
    (await fs.readdir(target)).sort(),
    ["english-study-review", ...names].sort(),
  );
});

test("第二個同名目錄不受管理時拒絕，第一個也不先寫入", async (t) => {
  const { target, run } = await setup(t);
  const conflict = path.join(target, names[1]);
  await fs.mkdir(conflict, { recursive: true });
  await fs.writeFile(path.join(conflict, "SKILL.md"), "使用者自己的 skill");
  assert.notEqual(run().status, 0);
  assert.equal(
    await fs.readFile(path.join(conflict, "SKILL.md"), "utf8"),
    "使用者自己的 skill",
  );
  await assert.rejects(fs.lstat(path.join(target, names[0])), {
    code: "ENOENT",
  });
});

test("拒絕覆蓋符號連結，拒絕經目標路徑寫回 CLI 來源", async (t) => {
  const { root, target, run } = await setup(t);
  const external = path.join(root, "external");
  await fs.mkdir(external);
  await fs.mkdir(target);
  await fs.writeFile(path.join(external, "SKILL.md"), "保留原檔");
  await fs.symlink(external, path.join(target, names[0]), "dir");
  assert.notEqual(run().status, 0);
  assert.equal(
    await fs.readFile(path.join(external, "SKILL.md"), "utf8"),
    "保留原檔",
  );
  const alias = path.join(root, "cli-alias");
  await fs.symlink(cliRoot, alias, "dir");
  assert.notEqual(run("--target-dir", path.join(alias, "skills")).status, 0);
});
