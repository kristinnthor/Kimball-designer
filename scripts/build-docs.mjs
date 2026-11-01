// Generates the user guide from the help content in src/core/help.ts:
// docs/USER-GUIDE.md (with screenshots) and the skill reference (text only).
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/core/help.ts'],
  bundle: true,
  write: false,
  platform: 'neutral',
  format: 'esm',
  logLevel: 'warning',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

const note = 'Generated from src/core/help.ts by `npm run build:docs`. Do not edit by hand.';
const targets = [
  { file: 'docs/USER-GUIDE.md', options: { images: true, note } },
  { file: 'plugin/skills/kimball-designer/references/user-guide.md', options: { images: false, note } },
];
for (const { file, options } of targets) {
  writeFileSync(file, mod.helpToMarkdown(options));
  console.log(`wrote ${file}`);
}
