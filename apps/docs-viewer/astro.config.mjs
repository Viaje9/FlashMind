// @ts-check
import { defineConfig } from 'astro/config';

const base = process.env.DOCS_BASE ?? '/';

export default defineConfig({
  base,
});
