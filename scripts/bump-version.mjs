#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const webDir = join(rootDir, "apps", "web");
const packageJsonPath = join(webDir, "package.json");
const versionTsPath = join(webDir, "src", "version.ts");

/**
 * 檢查是否有 apps/web/ 相關的 staged 變更
 */
function hasWebChanges() {
  try {
    const result = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
    });
    const files = result.split("\n").filter(Boolean);
    return files.some((file) => file.startsWith("apps/web/"));
  } catch {
    return false;
  }
}

/**
 * 取得目前的 commit hash (short)
 */
function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * 遞增 patch 版號
 */
function bumpPatchVersion(version) {
  const parts = version.split(".");
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${version}`);
  }
  parts[2] = String(parseInt(parts[2], 10) + 1);
  return parts.join(".");
}

/**
 * 比較 semver（只支援 x.y.z 整數格式）
 * 回傳值：1 (a > b), 0 (a === b), -1 (a < b)
 */
function compareVersions(a, b) {
  const aParts = a.split(".").map((part) => parseInt(part, 10));
  const bParts = b.split(".").map((part) => parseInt(part, 10));

  if (
    aParts.length !== 3 ||
    bParts.length !== 3 ||
    aParts.some(Number.isNaN) ||
    bParts.some(Number.isNaN)
  ) {
    throw new Error(`Invalid version format: ${a} or ${b}`);
  }

  for (let i = 0; i < 3; i += 1) {
    if (aParts[i] > bParts[i]) return 1;
    if (aParts[i] < bParts[i]) return -1;
  }

  return 0;
}

/**
 * 讀取 HEAD 版本（apps/web/package.json）
 */
function getHeadVersion() {
  try {
    const content = execSync("git show HEAD:apps/web/package.json", {
      encoding: "utf-8",
    });
    const pkg = JSON.parse(content);
    if (typeof pkg.version !== "string") {
      throw new Error("HEAD package.json version is missing");
    }
    return pkg.version;
  } catch {
    return null;
  }
}

/**
 * 取得今天的日期 (YYYY-MM-DD 格式)
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 生成 version.ts 內容
 */
function generateVersionTs(version, date, commitHash) {
  return `// 此檔案由 scripts/bump-version.mjs 自動生成，請勿手動修改
export const VERSION = {
  version: '${version}',
  buildDate: '${date}',
  commitHash: '${commitHash}',
  displayString: \`FlashMind v${version} (Build ${date})\`
} as const;
`;
}

function main() {
  // 檢查是否有 web 相關變更
  if (!hasWebChanges()) {
    console.log("[bump-version] 沒有 apps/web/ 相關變更，跳過版號更新");
    process.exit(0);
  }

  console.log("[bump-version] 偵測到 apps/web/ 變更，開始更新版號...");

  // 讀取 package.json
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const currentVersion = packageJson.version;
  const headVersion = getHeadVersion();
  const baseVersion =
    headVersion && compareVersions(currentVersion, headVersion) < 0
      ? headVersion
      : currentVersion;
  const newVersion = bumpPatchVersion(baseVersion);

  if (headVersion && compareVersions(currentVersion, headVersion) < 0) {
    console.log(
      `[bump-version] 偵測到回退版號，改用 HEAD 版號 ${headVersion} 作為基準`,
    );
  }

  console.log(`[bump-version] 版號從 ${baseVersion} 更新為 ${newVersion}`);

  // 更新 package.json
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  // 生成 version.ts
  const date = getDateString();
  const commitHash = getCommitHash();
  const versionTsContent = generateVersionTs(newVersion, date, commitHash);
  writeFileSync(versionTsPath, versionTsContent);

  console.log("[bump-version] 已更新 version.ts");

  // 將更新的檔案加入 staging area
  execSync(`git add "${packageJsonPath}" "${versionTsPath}"`, {
    encoding: "utf-8",
  });
  console.log("[bump-version] 已將更新檔案加入 staging area");
}

main();
