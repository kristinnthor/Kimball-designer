import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HELP_CLI } from '../core';
import { runCli, type CliIO } from './cli';

let dir: string;
let stdout: string;
let stderr: string;

const io = (): CliIO => ({
  cwd: dir,
  out: (t) => (stdout += t),
  err: (t) => (stderr += t),
  loadUi: async () => '<!doctype html><title>ui</title>',
  openUrl: () => {},
  waitForExit: async () => {},
});
const run = (...args: string[]) => runCli(args, io());

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kd-cli-'));
  stdout = '';
  stderr = '';
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('kimball CLI', () => {
  it('prints help and version', async () => {
    expect(await run('--help')).toBe(0);
    expect(stdout).toContain('Usage: kimball <command>');
    stdout = '';
    expect(await run('--version')).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('documents every command and flag the help page lists', async () => {
    expect(await run('--help')).toBe(0);
    for (const { command } of HELP_CLI) {
      const [name, ...rest] = command.split(' ');
      expect(stdout).toMatch(new RegExp(`^  ${name}\\b`, 'm'));
      for (const flag of rest.filter((w) => w.startsWith('--'))) expect(stdout).toContain(flag);
    }
  });

  it('init creates the default file and refuses to overwrite', async () => {
    expect(await run('init', '--name', 'Sales DW')).toBe(0);
    const file = join(dir, 'kimball', 'project.kimball.json');
    expect(JSON.parse(readFileSync(file, 'utf8')).meta.name).toBe('Sales DW');
    expect(await run('init')).toBe(1);
    expect(stderr).toContain('already exists');
    expect(await run('init', '--force')).toBe(0);
  });

  it('init --example copies an example and rejects unknown ones', async () => {
    expect(await run('init', 'retail.kimball.json', '--example', 'retail')).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, 'retail.kimball.json'), 'utf8')).processes).toHaveLength(4);
    expect(await run('init', 'x.kimball.json', '--example', 'nope')).toBe(1);
    expect(stderr).toContain('Unknown example');
  });

  it('summary reports progress and the next phase', async () => {
    await run('init', 'p.kimball.json');
    stdout = '';
    expect(await run('summary', 'p.kimball.json')).toBe(0);
    expect(stdout).toContain('Progress: 0/11 phases complete');
    expect(stdout).toContain('Suggested next step: phase 1 "Kickoff"');
  });

  it('validate exits 1 on errors, supports --json and --strict', async () => {
    await run('init', 'p.kimball.json');
    expect(await run('validate', 'p.kimball.json')).toBe(1); // KD001: no name
    expect(stdout).toContain('KD001');
    stdout = '';
    expect(await run('validate', 'p.kimball.json', '--json')).toBe(1);
    expect(JSON.parse(stdout).counts.error).toBe(1);

    await run('init', 'r.kimball.json', '--example', 'retail');
    expect(await run('validate', 'r.kimball.json', '--strict')).toBe(0);
  });

  it('render writes every deliverable', async () => {
    await run('init', 'r.kimball.json', '--example', 'retail');
    expect(await run('render', 'r.kimball.json', '--out', 'deliverables')).toBe(0);
    const out = join(dir, 'deliverables');
    expect(readdirSync(out).sort()).toEqual(['bubbles', 'bus-matrix.csv', 'bus-matrix.html', 'bus-matrix.md', 'requirements.md']);
    expect(readdirSync(join(out, 'bubbles'))).toContain('retail-sales.svg');
    expect(readdirSync(join(out, 'bubbles'))).toContain('retail-sales.mmd');
    expect(readFileSync(join(out, 'bus-matrix.md'), 'utf8')).toContain('**Date**');
  });

  it('render defaults to an out folder next to the file', async () => {
    await run('init', 'models/r.kimball.json', '--example', 'saas');
    expect(await run('render', 'models/r.kimball.json')).toBe(0);
    expect(existsSync(join(dir, 'models', 'out', 'requirements.md'))).toBe(true);
  });

  it('gives readable errors for missing and broken files', async () => {
    expect(await run('summary', 'missing.kimball.json')).toBe(1);
    expect(stderr).toContain('kimball init');
    writeFileSync(join(dir, 'broken.kimball.json'), '{ "meta": ');
    expect(await run('validate', 'broken.kimball.json')).toBe(1);
    expect(stderr).toContain('not valid JSON');
    expect(await run('frobnicate')).toBe(1);
    expect(await run('summary', '--bogus')).toBe(2);
  });

  it('ddl prints or writes the CREATE TABLE script for a dialect', async () => {
    await run('init', 'r.kimball.json', '--example', 'retail');
    expect(await run('ddl', 'r.kimball.json')).toBe(0);
    expect(stdout).toContain('star schema for PostgreSQL');
    expect(stdout).toContain('CREATE TABLE fact_retail_sales (');
    stdout = '';
    expect(await run('ddl', 'r.kimball.json', '--dialect', 'sqlserver', '--drop', '--out', 'sql/schema.sql')).toBe(0);
    const sql = readFileSync(join(dir, 'sql', 'schema.sql'), 'utf8');
    expect(sql).toContain('CLUSTERED COLUMNSTORE');
    expect(sql).toContain('DROP TABLE IF EXISTS fact_retail_sales;');
    expect(await run('ddl', 'r.kimball.json', '--dialect', 'oracle')).toBe(1);
    expect(stderr).toContain('Unknown dialect');
  });

  it('prototype writes the sandbox bundle', async () => {
    await run('init', 'models/r.kimball.json', '--example', 'saas');
    expect(await run('prototype', 'models/r.kimball.json', '--rows', '50', '--seed', '7', '--dialect', 'snowflake')).toBe(0);
    const out = join(dir, 'models', 'prototype');
    expect(readdirSync(out).sort()).toEqual(
      ['README.md', 'data', 'data.snowflake.sql', 'docker-compose.yml', 'index-recommendations.md', 'initdb', 'queries.sql', 'schema.sql'].sort(),
    );
    expect(readdirSync(join(out, 'initdb'))).toEqual(['01-schema.sql', '02-data.sql']);
    expect(readFileSync(join(out, 'schema.sql'), 'utf8')).toContain('Snowflake');
    expect(readFileSync(join(out, 'initdb', '02-data.sql'), 'utf8')).toContain('Seed 7');
    const facts = readFileSync(join(out, 'data', 'fact_subscription_changes.csv'), 'utf8').trim().split('\r\n');
    expect(facts).toHaveLength(51);
    expect(stdout).toContain('docker compose up -d');
    expect(await run('prototype', 'models/r.kimball.json', '--rows', 'many')).toBe(1);
  });

  it('serve creates the file and starts and stops a server', async () => {
    expect(await run('serve', 'live.kimball.json', '--port', '0')).toBe(0);
    expect(stdout).toContain('→ http://127.0.0.1:');
    expect(existsSync(join(dir, 'live.kimball.json'))).toBe(true);
  });
});

describe('kimball guide', () => {
  it('lists phases and prints coaching notes for one phase', async () => {
    expect(await run('guide')).toBe(0);
    expect(stdout).toContain('grain');
    stdout = '';
    expect(await run('guide', 'grain')).toBe(0);
    expect(stdout).toContain('# Phase 5: Grain');
    expect(stdout).toContain('## Ask');
    stdout = '';
    expect(await run('guide', 'stakeholders')).toBe(0);
    expect(stdout).toContain('Interview questions — Executive');
    expect(await run('guide', 'nope')).toBe(1);
  });
});
