export default {
  "apps/api/**/*.ts": (files) =>
    `pnpm --filter ./apps/api exec eslint --no-warn-ignored --fix ${files.join(" ")}`,
  "apps/web/**/*.{ts,html}": (files) =>
    `pnpm --filter ./apps/web exec eslint --no-warn-ignored --fix ${files.join(" ")}`,
  "*.{ts,html,css,json,yaml,yml,md,mjs}": (files) =>
    `prettier --write --ignore-unknown ${files.join(" ")}`,
};
