import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(cliRoot, "skills");
const skills = ["flashmind-practice", "flashmind-review"];
const markerName = ".flashmind-installation.json";
const help = `將 apps/cli/skills 的兩個 FlashMind skill 同步到全域。

用法：pnpm skills:sync [--dry-run] [--target-dir <目錄>]
預設：CODEX_HOME 下的 skills；未設定時為 ~/.codex/skills。
--dry-run：只核對來源與目標，不建立目錄或寫入。
--target-dir：指定其他全域 skills 目錄，或測試用目錄。
只更新本 script 管理的同名目錄，不覆蓋其他 skill 或符號連結。
`;

async function optionalStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function inside(parent, child) {
  const part = relative(parent, child);
  return (
    part === "" ||
    (part !== ".." && !part.startsWith("../") && !isAbsolute(part))
  );
}

// 目標尚未建立時也核對實際父目錄，避免經由 symlink 寫回來源。
async function canonical(path) {
  const stat = await optionalStat(path);
  if (stat) return realpath(path);
  return join(await canonical(dirname(path)), relative(dirname(path), path));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(help);
    return;
  }
  let dryRun = false;
  let targetRoot = join(
    process.env.CODEX_HOME || join(homedir(), ".codex"),
    "skills",
  );
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    else if (
      args[i] === "--target-dir" &&
      args[i + 1] &&
      !args[i + 1].startsWith("-")
    )
      targetRoot = args[++i];
    else
      throw new Error(`未知或不完整的選項：${args[i]}。使用 --help 查看用法。`);
  }
  targetRoot = await canonical(resolve(targetRoot));
  if (inside(await realpath(cliRoot), targetRoot))
    throw new Error("同步目標不可位於 apps/cli 內，避免覆蓋來源或遞迴複製。");

  // 先核對全部目標，第二個衝突時也不先改第一個。
  for (const name of skills) {
    const source = join(sourceRoot, name);
    if (!(await optionalStat(join(source, "SKILL.md")))?.isFile())
      throw new Error(`缺少 ${source}/SKILL.md。`);
    const target = join(targetRoot, name);
    const stat = await optionalStat(target);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error(`拒絕覆蓋既有檔案或符號連結：${target}`);
      let marker;
      try {
        marker = JSON.parse(await readFile(join(target, markerName), "utf8"));
      } catch {
        throw new Error(`目標不是本 script 管理的 skill，保留原檔：${target}`);
      }
      if (marker.managedBy !== "@flashmind/cli" || marker.skill !== name)
        throw new Error(`目標管理資訊不符，保留原檔：${target}`);
    }
    process.stdout.write(
      `${dryRun ? "[dry-run] " : ""}${source} -> ${target}\n`,
    );
  }
  if (dryRun) {
    process.stdout.write("檢查完成，沒有寫入任何檔案。\n");
    return;
  }

  await mkdir(targetRoot, { recursive: true });
  for (const name of skills) {
    const target = join(targetRoot, name);
    const staging = await mkdtemp(join(targetRoot, ".flashmind-sync-"));
    const prepared = join(staging, name);
    const backup = join(staging, "previous");
    try {
      await cp(join(sourceRoot, name), prepared, { recursive: true });
      await writeFile(
        join(prepared, markerName),
        JSON.stringify(
          {
            managedBy: "@flashmind/cli",
            skill: name,
            cliRoot: await realpath(cliRoot),
          },
          null,
          2,
        ) + "\n",
      );
      // JSON 字串放在 JavaScript 檔，不經 shell 展開；路徑含空白也可用。
      const runner = `try {\n  require(${JSON.stringify(join(await realpath(cliRoot), "scripts/skill-cli.cjs"))});\n} catch {\n  process.stderr.write("FlashMind 專案已搬移或遺失，請在正確專案重新執行 pnpm skills:sync。\\n");\n  process.exitCode = 2;\n}\n`;
      await writeFile(join(prepared, "scripts/flashmind.cjs"), runner);
      const existed = Boolean(await optionalStat(target));
      if (existed) await rename(target, backup);
      try {
        await rename(prepared, target);
      } catch (error) {
        if (existed) await rename(backup, target);
        throw error;
      }
    } finally {
      // 僅清除此輪建立的 staging 與已成功替換的受管理舊版本。
      // 回復失敗時保留 backup，不刪掉唯一原檔。
      if (!(await optionalStat(backup)) || (await optionalStat(target)))
        await rm(staging, { recursive: true, force: true });
    }
  }
  process.stdout.write(
    "已同步 flashmind-practice 與 flashmind-review；其他 skills 保持不變。\n",
  );
}

main().catch((error) => {
  process.stderr.write(`同步失敗：${error.message}\n`);
  process.exitCode = 1;
});
