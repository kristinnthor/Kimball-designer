import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  APP_VERSION,
  EXAMPLES,
  GUIDANCE,
  INTERVIEW_QUESTIONS,
  PHASES,
  SQL_DIALECTS,
  STAKEHOLDER_TYPES,
  ProjectParseError,
  bubbleToMermaid,
  bubbleToSvg,
  busMatrixToCsv,
  busMatrixToHtml,
  busMatrixToMarkdown,
  countBySeverity,
  createProject,
  ddlScript,
  displayName,
  isExampleId,
  loadExample,
  physicalSettings,
  projectSummaryText,
  prototypeFiles,
  requirementsToMarkdown,
  slugify,
  validateProject,
  type SqlDialect,
  type ThemeName,
} from '../core';
import { readProject, writeFileAtomic, writeProject } from './io';
import { DEFAULT_PORT, startServer } from './server';

export const DEFAULT_FILE = 'kimball/project.kimball.json';

export interface CliIO {
  cwd: string;
  out: (text: string) => void;
  err: (text: string) => void;
  /** Loads the single-file UI for `serve`. */
  loadUi: () => Promise<string>;
  /** Opens a URL in the default browser (serve --open). */
  openUrl: (url: string) => void;
  /** Resolves when a running server should stop (Ctrl+C). */
  waitForExit: () => Promise<void>;
}

const HELP = `Kimball Designer ${APP_VERSION} — from first interview to bus matrix

Usage: kimball <command> [file] [options]

Commands
  init [file]        Create a project file (default ${DEFAULT_FILE})
      --name <text>      Project name
      --example <id>     Start from an example: ${EXAMPLES.map((e) => e.id).join(', ')}
      --force            Overwrite an existing file
  summary <file>     Phase-by-phase progress and what to do next
  validate <file>    Check the model against Kimball best practices
      --json             Machine-readable findings
      --strict           Exit 1 on warnings as well as errors
  render <file>      Write deliverables (requirements.md, bus matrix, bubble diagrams)
      --out <dir>        Output folder (default: <file folder>/out)
      --theme <name>     light (default) or dark
  ddl <file>         Print the CREATE TABLE script with keys and index advice
      --dialect <name>   postgres (default), sqlserver or snowflake
      --out <file>       Write to a file instead
      --drop             Start with DROP TABLE IF EXISTS
  prototype <file>   Write the prototype: Docker sandbox, scripts, sample data, CSV, dbt
      --out <dir>        Output folder (default: <file folder>/prototype)
      --dialect <name>   Target platform for schema.sql
      --seed <n>         Seed for the sample data
      --rows <n>         Sample rows per fact table
  serve [file]       Open the guided UI on the project file with live sync
      --port <n>         Port (default ${DEFAULT_PORT})
      --open             Open the browser
  guide [phase]      Coaching notes for a phase: why, what to ask, tips, pitfalls
  examples           List example projects
  help, --help       Show this help
  version, --version Show the version
`;

export async function runCli(argv: string[], io: CliIO): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        name: { type: 'string' },
        example: { type: 'string' },
        force: { type: 'boolean' },
        json: { type: 'boolean' },
        strict: { type: 'boolean' },
        out: { type: 'string' },
        theme: { type: 'string' },
        port: { type: 'string' },
        open: { type: 'boolean' },
        dialect: { type: 'string' },
        drop: { type: 'boolean' },
        seed: { type: 'string' },
        rows: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (e) {
    io.err(`${(e as Error).message}\nRun "kimball --help" for usage.\n`);
    return 2;
  }
  const { values: opts, positionals } = parsed;
  const [command = 'help', fileArg] = positionals;
  if (opts.version || command === 'version') {
    io.out(`${APP_VERSION}\n`);
    return 0;
  }
  if (opts.help || command === 'help') {
    io.out(HELP);
    return 0;
  }

  const file = resolve(io.cwd, fileArg ?? DEFAULT_FILE);
  const rel = (p: string) => relative(io.cwd, p) || '.';

  const dialectOption = (fallback: SqlDialect): SqlDialect => {
    if (!opts.dialect) return fallback;
    const match = SQL_DIALECTS.find((d) => d.value === opts.dialect || d.label.toLowerCase() === opts.dialect!.toLowerCase());
    if (!match) throw new CliError(`Unknown dialect "${opts.dialect}". Choose one of: ${SQL_DIALECTS.map((d) => d.value).join(', ')}.`);
    return match.value;
  };
  const positiveInt = (name: string, value: string | undefined): number | undefined => {
    if (value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new CliError(`--${name} must be a whole number, got "${value}".`);
    return n;
  };

  const load = async () => {
    if (!existsSync(file)) throw new CliError(`No project file at ${rel(file)}. Create one with "kimball init ${rel(file)}".`);
    return readProject(file);
  };

  try {
    switch (command) {
      case 'init': {
        if (existsSync(file) && !opts.force) throw new CliError(`${rel(file)} already exists. Use --force to overwrite.`);
        let project;
        if (opts.example) {
          if (!isExampleId(opts.example)) {
            throw new CliError(`Unknown example "${opts.example}". Choose one of: ${EXAMPLES.map((e) => e.id).join(', ')}.`);
          }
          project = loadExample(opts.example, new Date().toISOString());
        } else {
          project = createProject(opts.name ?? '');
        }
        if (opts.name) project.meta.name = opts.name;
        await writeProject(file, project);
        io.out(`Created ${rel(file)}${opts.example ? ` from the "${opts.example}" example` : ''}.\n`);
        io.out(`Next: "kimball serve ${rel(file)}" to open the guided UI, or edit the file and run "kimball summary ${rel(file)}".\n`);
        return 0;
      }

      case 'summary': {
        io.out(projectSummaryText(await load()));
        return 0;
      }

      case 'validate': {
        const project = await load();
        const findings = validateProject(project);
        const counts = countBySeverity(findings);
        if (opts.json) {
          io.out(JSON.stringify({ file: rel(file), counts, findings }, null, 2) + '\n');
        } else {
          for (const f of findings) io.out(`${f.severity.padEnd(7)} ${f.code}  ${f.message}\n        ↳ ${f.hint}\n`);
          io.out(`\n${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} note(s) in ${rel(file)}\n`);
        }
        return counts.error > 0 || (opts.strict && counts.warning > 0) ? 1 : 0;
      }

      case 'render': {
        const project = await load();
        const theme: ThemeName = opts.theme === 'dark' ? 'dark' : 'light';
        const outDir = resolve(io.cwd, opts.out ?? join(file, '..', 'out'));
        const written: string[] = [];
        const write = async (name: string, text: string) => {
          const target = join(outDir, name);
          await writeFileAtomic(target, text);
          written.push(rel(target));
        };
        await write('requirements.md', requirementsToMarkdown(project));
        await write('bus-matrix.md', busMatrixToMarkdown(project));
        await write('bus-matrix.csv', busMatrixToCsv(project));
        await write('bus-matrix.html', busMatrixToHtml(project, { theme }));
        const used = new Set<string>();
        for (const p of project.processes) {
          let slug = slugify(displayName(p), 'process');
          while (used.has(slug)) slug += '-2';
          used.add(slug);
          await write(`bubbles/${slug}.svg`, bubbleToSvg(project, p, { theme }));
          await write(`bubbles/${slug}.mmd`, bubbleToMermaid(project, p));
        }
        io.out(`Rendered ${written.length} file(s) to ${rel(outDir)}:\n${written.map((w) => `  ${w}`).join('\n')}\n`);
        const counts = countBySeverity(validateProject(project));
        if (counts.error + counts.warning > 0) {
          io.out(`Note: ${counts.error} error(s) and ${counts.warning} warning(s) — run "kimball validate ${rel(file)}".\n`);
        }
        return 0;
      }

      case 'ddl': {
        const project = await load();
        const sql = ddlScript(project, { dialect: dialectOption(physicalSettings(project).dialect), dropFirst: opts.drop });
        if (opts.out) {
          const target = resolve(io.cwd, opts.out);
          await writeFileAtomic(target, sql);
          io.out(`Wrote ${rel(target)}.\n`);
        } else {
          io.out(sql);
        }
        return 0;
      }

      case 'prototype': {
        const project = await load();
        const base = physicalSettings(project);
        const seed = positiveInt('seed', opts.seed);
        const rows = positiveInt('rows', opts.rows);
        const settings = {
          ...base,
          dialect: dialectOption(base.dialect),
          seed: seed ?? base.seed,
          rows: { ...base.rows },
        };
        if (rows !== undefined) {
          if (rows < 1) throw new CliError('--rows must be at least 1.');
          for (const p of project.processes) settings.rows[p.id] = Math.min(rows, 100_000);
        }
        const outDir = resolve(io.cwd, opts.out ?? join(file, '..', 'prototype'));
        const files = prototypeFiles(project, settings);
        for (const f of files) await writeFileAtomic(join(outDir, f.name), f.data);
        io.out(`Wrote the prototype (${files.length} files) to ${rel(outDir)}.\n`);
        io.out(`Start the PostgreSQL sandbox (needs Docker):\n  cd ${rel(outDir)}\n  docker compose up -d\n  docker compose exec db psql -U kimball -d kimball\n`);
        io.out(`schema.sql is for ${SQL_DIALECTS.find((d) => d.value === settings.dialect)!.label}; index advice is in index-recommendations.md; dbt/ is a dbt project (see dbt/README.md).\n`);
        return 0;
      }

      case 'serve': {
        const port = opts.port ? Number(opts.port) : DEFAULT_PORT;
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError(`Invalid port "${opts.port}".`);
        if (!existsSync(file)) {
          await writeProject(file, createProject(opts.name ?? ''));
          io.out(`Created ${rel(file)}.\n`);
        } else {
          await readProject(file); // fail fast on a broken file
        }
        const server = await startServer({
          file,
          port,
          uiHtml: await io.loadUi(),
          log: (m) => io.out(`[${new Date().toLocaleTimeString()}] ${m}\n`),
        });
        io.out(`Kimball Designer is editing ${rel(file)}\n  → ${server.url}\nChanges in the browser are saved to the file; edits to the file appear in the browser. Ctrl+C to stop.\n`);
        if (opts.open) io.openUrl(server.url);
        await io.waitForExit();
        await server.close();
        return 0;
      }

      case 'guide': {
        const phase = PHASES.find((p) => p.id === fileArg);
        if (!fileArg) {
          io.out('Phases (run "kimball guide <phase>" for coaching notes):\n\n');
          for (const p of PHASES) io.out(`  ${String(p.number).padStart(2)}  ${p.id.padEnd(13)} ${p.goal}\n`);
          return 0;
        }
        if (!phase) throw new CliError(`Unknown phase "${fileArg}". Phases: ${PHASES.map((p) => p.id).join(', ')}.`);
        const g = GUIDANCE[phase.id];
        const list = (title: string, items: string[]) => (items.length ? `\n## ${title}\n${items.map((i) => `- ${i}`).join('\n')}\n` : '');
        io.out(`# Phase ${phase.number}: ${phase.title}\n\nGoal: ${phase.goal}\n\n${g.why}\n`);
        io.out(list('Ask', g.ask) + list('Tips', g.tips) + list('Avoid', g.pitfalls) + list('Examples', g.examples));
        if (phase.id === 'stakeholders') {
          for (const t of STAKEHOLDER_TYPES) io.out(list(`Interview questions — ${t.label}`, INTERVIEW_QUESTIONS[t.value]));
        }
        return 0;
      }

      case 'examples': {
        for (const e of EXAMPLES) io.out(`${e.id.padEnd(12)} ${e.title} — ${e.description}\n`);
        return 0;
      }

      default:
        throw new CliError(`Unknown command "${command}". Run "kimball --help".`);
    }
  } catch (e) {
    if (e instanceof CliError || e instanceof ProjectParseError) {
      io.err(`${e.message}\n`);
      return 1;
    }
    if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      io.err(`Port ${opts.port ?? DEFAULT_PORT} is in use. Try --port ${Number(opts.port ?? DEFAULT_PORT) + 1}.\n`);
      return 1;
    }
    throw e;
  }
}

export class CliError extends Error {}

/** Reads a file, or returns a helpful placeholder page when the UI bundle hasn't been built. */
export async function readUiOrPlaceholder(path: string): Promise<string> {
  if (existsSync(path)) return readFile(path, 'utf8');
  return `<!doctype html><meta charset="utf-8"><title>Kimball Designer</title><body style="font-family:system-ui;padding:2rem">
<h1>UI bundle not found</h1><p>Expected <code>${path.replace(/</g, '&lt;')}</code>. Run <code>npm run build:skill</code> in the Kimball Designer repository.</p>`;
}
