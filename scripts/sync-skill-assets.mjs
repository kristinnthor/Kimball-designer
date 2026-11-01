// Copies generated, non-code assets (JSON Schema, example projects) into the skill folder.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const skill = 'plugin/skills/kimball-designer';
const copies = [
  { from: 'src/core/schema', to: join(skill, 'schema'), match: /\.schema\.json$/ },
  { from: 'src/core/examples', to: join(skill, 'examples'), match: /\.kimball\.json$/ },
];

for (const { from, to, match } of copies) {
  // Clear previous outputs first so assets removed from src/ don't linger in the skill.
  if (existsSync(to)) for (const f of readdirSync(to)) if (match.test(f)) rmSync(join(to, f));
  if (!existsSync(from)) continue;
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from).filter((n) => match.test(n)).sort()) {
    copyFileSync(join(from, f), join(to, f));
    console.log(`synced ${join(to, f)}`);
  }
}
