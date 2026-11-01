// Usage: node scripts/bump-version.mjs 1.0.0
// Sets the version in package.json, the plugin and marketplace manifests,
// and turns CHANGELOG "Unreleased" into a dated release section.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error('Usage: node scripts/bump-version.mjs <semver>');
  process.exit(2);
}

const json = (file, update) => {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  update(data);
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`updated ${file}`);
};

json('package.json', (p) => (p.version = version));
json('package-lock.json', (p) => {
  p.version = version;
  if (p.packages?.['']) p.packages[''].version = version;
});
json('plugin/.claude-plugin/plugin.json', (p) => (p.version = version));
json('.claude-plugin/marketplace.json', (m) => m.plugins.forEach((p) => (p.version = version)));

const today = new Date().toISOString().slice(0, 10);
const changelog = readFileSync('CHANGELOG.md', 'utf8');
if (!changelog.includes(`## [${version}]`)) {
  writeFileSync('CHANGELOG.md', changelog.replace('## [Unreleased]', `## [Unreleased]\n\n## [${version}] — ${today}`));
  console.log('updated CHANGELOG.md');
}
console.log(`\nNext: npm run build:skill && git commit -am "chore: release v${version}" && git tag v${version} && git push --follow-tags`);
