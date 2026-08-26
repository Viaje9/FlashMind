import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve("2000-words.md");
const outputPath = resolve("target-vocabulary-import.json");
const words = (await readFile(sourcePath, "utf8"))
  .split(/\r?\n/)
  .map((word) => word.trim())
  .filter(Boolean);

const translations = [];
const batchSize = 80;

for (let offset = 0; offset < words.length; offset += batchSize) {
  const batch = words.slice(offset, offset + batchSize);
  const body = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: "zh-TW",
    dt: "t",
    q: batch.join("\n"),
  });
  const response = await fetch(
    "https://translate.googleapis.com/translate_a/single",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`翻譯失敗：HTTP ${response.status}`);

  const payload = await response.json();
  const translatedText = payload[0].map((segment) => segment[0]).join("");
  const translatedBatch = translatedText
    .split("\n")
    .map((meaning) => meaning.trim());
  if (translatedBatch.length !== batch.length) {
    throw new Error(
      `第 ${offset + 1} 筆起的翻譯行數不符：預期 ${batch.length}，得到 ${translatedBatch.length}`,
    );
  }
  translations.push(...translatedBatch);
  process.stdout.write(`已翻譯 ${translations.length}/${words.length}\n`);
}

const data = {
  words: words.map((term, index) => ({ term, zhMeaning: translations[index] })),
};

await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`已建立 ${outputPath}`);
