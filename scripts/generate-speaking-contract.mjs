import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { format } from "prettier";

const root = new URL("../", import.meta.url);
const document = YAML.parse(
  await readFile(new URL("openapi/speaking-history.yaml", root), "utf8"),
);
const schemas = document.components.schemas;
const nameOf = (ref) => ref.split("/").at(-1);
function typeOf(schema) {
  const type = schema.$ref
    ? nameOf(schema.$ref)
    : schema.enum
      ? schema.enum.map((value) => JSON.stringify(value)).join(" | ")
      : schema.type === "array"
        ? `Array<${typeOf(schema.items)}>`
        : schema.type === "object"
          ? `{\n${Object.entries(schema.properties ?? {})
              .map(
                ([name, value]) =>
                  `  ${JSON.stringify(name)}${schema.required?.includes(name) ? "" : "?"}: ${typeOf(value)};`,
              )
              .join("\n")}\n}`
          : schema.type === "integer" || schema.type === "number"
            ? "number"
            : schema.type === "boolean"
              ? "boolean"
              : "string";
  return schema.nullable ? `(${type}) | null` : type;
}
function jsonSchema(value) {
  if (Array.isArray(value)) return value.map(jsonSchema);
  if (!value || typeof value !== "object") return value;
  const { nullable, ...rest } = value;
  const result = Object.fromEntries(
    Object.entries(rest).map(([key, item]) => [
      key,
      key === "$ref"
        ? item.replace("#/components/schemas/", "#/definitions/")
        : jsonSchema(item),
    ]),
  );
  return nullable ? { anyOf: [result, { type: "null" }] } : result;
}
const output = new URL("packages/shared/src/generated/", root);
await mkdir(output, { recursive: true });
await writeFile(
  new URL("speaking.ts", output),
  await format(
    "// 此檔由 openapi/speaking-history.yaml 產生，請勿手動修改。\n" +
      Object.entries(schemas)
        .map(([name, schema]) => `export type ${name} = ${typeOf(schema)};\n`)
        .join("\n"),
    { parser: "typescript" },
  ),
);
await writeFile(
  new URL("speaking.schema.json", output),
  await format(JSON.stringify({ definitions: jsonSchema(schemas) }), {
    parser: "json",
  }),
);
console.log(
  `已由 OpenAPI 產生 ${Object.keys(schemas).length} 個無框架型別與驗證 schema：${fileURLToPath(output)}`,
);
