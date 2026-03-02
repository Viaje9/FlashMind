export default {
  "apps/api/**/*.ts": (files) =>
    `corepack pnpm --filter ./apps/api exec eslint --no-warn-ignored --fix ${files.join(" ")}`,
  "apps/web/**/*.{ts,html}": (files) =>
    `corepack pnpm --filter ./apps/web exec eslint --no-warn-ignored --fix ${files.join(" ")}`,
  "*.{ts,html,css,json,yaml,yml,md,mjs}": (files) =>
    `corepack pnpm exec prettier --write --ignore-unknown ${files.join(" ")}`,
};
