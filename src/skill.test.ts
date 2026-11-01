import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Guards the shipped skill and plugin packaging (not product code).
const root = join(__dirname, '..');
const skillDir = join(root, 'plugin', 'skills', 'kimball-designer');
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
const plugin = JSON.parse(readFileSync(join(root, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));

function frontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('SKILL.md must start with YAML frontmatter on line 1');
  const out: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const i = line.indexOf(': ');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 2);
  }
  return out;
}

describe('skill package', () => {
  const fm = frontmatter(skill);

  it('has valid frontmatter', () => {
    expect(fm.name).toBe('kimball-designer');
    expect(fm.name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(fm.description!.length).toBeGreaterThan(50);
    expect(fm.description!.length).toBeLessThanOrEqual(200); // claude.ai upload limit
    expect(fm.description).not.toMatch(/: /); // would break an unquoted YAML scalar
    expect(Object.keys(fm).every((k) => ['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'].includes(k))).toBe(true);
  });

  it('only references files that exist in the skill folder', () => {
    const refs = [...skill.matchAll(/`(?:\$\{CLAUDE_SKILL_DIR\}\/)?((?:references|scripts|schema|ui|examples)\/[\w./-]+?)`/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(5);
    for (const ref of refs.filter((r) => !r.includes('{'))) expect(existsSync(join(skillDir, ref)), ref).toBe(true);
    for (const ex of ['retail', 'saas', 'healthcare']) expect(existsSync(join(skillDir, 'examples', `${ex}.kimball.json`))).toBe(true);
  });

  it('documents every CLI command it uses', () => {
    const help = readFileSync(join(root, 'src', 'cli', 'cli.ts'), 'utf8');
    for (const cmd of [...new Set([...skill.matchAll(/\$KD (\w+)/g)].map((m) => m[1]!))]) {
      expect(help, `kimball ${cmd}`).toContain(`case '${cmd}'`);
    }
  });

  it('keeps plugin and marketplace manifests consistent with package.json', () => {
    expect(marketplace.name).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
    expect(marketplace.owner.name).toBeTruthy();
    const entry = marketplace.plugins.find((p: { name: string }) => p.name === plugin.name);
    expect(entry).toBeTruthy();
    expect(entry.source).toBe('./plugin');
    expect(plugin.version).toBe(pkg.version);
    expect(entry.version).toBe(pkg.version);
    expect(fm.name).toBe(plugin.name);
  });
});
