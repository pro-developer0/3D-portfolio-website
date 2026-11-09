import { defineConfig } from 'vite';
import { profile } from './src/content.js';
import { flatHTML, esc } from './src/render.js';

// Writes the real portfolio text into index.html at build time, so crawlers,
// link previews and no-JS visitors get all of it without running any WebGL.
const injectContent = () => ({
  name: 'inject-content',
  transformIndexHtml: (html) =>
    html
      .replaceAll('%TITLE%', esc(`${profile.name} — ${profile.role}`))
      .replaceAll('%DESCRIPTION%', esc(profile.intro))
      .replace('<!--flat-->', flatHTML()),
});

export default defineConfig({
  base: './',
  plugins: [injectContent()],
  build: { chunkSizeWarningLimit: 900 },
});
