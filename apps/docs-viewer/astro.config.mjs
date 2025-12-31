// @ts-check
import { defineConfig } from 'astro/config';

const rawBase = process.env.DOCS_BASE ?? '/';
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default defineConfig({
  base,
});
