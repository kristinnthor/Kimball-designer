import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Inline the favicon as a data URI so the single-file build has no external assets.
const faviconSvg = readFileSync(new URL('./brand/favicon.svg', import.meta.url), 'utf8').replace(/\s+/g, ' ').trim();
const inlineFavicon: Plugin = {
  name: 'kd-inline-favicon',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('./brand/favicon.svg', `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`),
  },
};

// The hosted site serves the social preview next to the page for its og:image tag.
const socialPreview: Plugin = {
  name: 'kd-social-preview',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'social-preview.png',
      source: readFileSync(new URL('./brand/social-preview.png', import.meta.url)),
    });
  },
};

// `--mode skill` builds the single-file offline UI that ships inside the skill.
// `--mode web` (default for dev) builds the hosted UI into dist/.
export default defineConfig(({ mode }) => {
  const skill = mode === 'skill';
  return {
    base: './',
    plugins: [inlineFavicon, react(), ...(skill ? [viteSingleFile({ removeViteModuleLoader: true })] : [socialPreview])],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: {
      outDir: skill ? 'plugin/skills/kimball-designer/ui' : 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
    },
  };
});
