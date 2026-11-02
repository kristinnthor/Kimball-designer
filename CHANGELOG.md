# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Brand identity: logo mark, lockups, social preview, design tokens and guidelines (`brand/`).
- Process runbook, architecture overview, decision records, methodology and roadmap (`docs/`).
- Issue and pull request templates.
- Toolchain: Vite 6 + React 19 + TypeScript 5.9 + Vitest 3; single-file UI build and zero-dependency CLI bundle inside the skill (#6).
- CI: typecheck, tests, builds, skill-bundle drift check, CLI compatibility on Node 18/20/22 (#7).
- Core engine (`src/core`): project model and JSON Schema v1 (#8), validation with 16 Kimball best-practice rules (#9), bus matrix derivation with Markdown/CSV/HTML export (#10), bubble diagram layout with SVG and Mermaid export (#11), requirements document generator (#12), progress summary, and three example projects — retail, SaaS, healthcare (#26).
- `kimball` CLI bundled into the skill: `init` (incl. `--example`), `summary`, `validate` (`--json`, `--strict`), `render` and `examples`; runs on Node 18+ with no install (#13).
- `kimball serve`: serves the guided UI and a localhost-only JSON API over the project file, with atomic writes, conflict detection and DNS-rebinding protection (#14).
- Guided web UI: ten phases in three stages (Discover → Model → Deliver) with a live progress stepper, coach panel, light/dark themes, undo/redo, and autosave (#15–#21).
- Live two-way sync with `kimball serve`: browser edits are saved to the project file, and edits made by Claude show up in the browser (#16).
- Interactive bubble diagrams (SVG/PNG/Mermaid export), a keyboard-operable bus matrix grid, and a review phase with findings, deliverables, a zip download and a Claude hand-off summary (#22–#24).
- Shared coaching content for the UI coach and `kimball guide <phase>` (#25); start from an example in the UI (#26); single-file offline UI bundled in the skill (#27).

- Claude skill `kimball-designer`: an orchestrated ten-phase workflow (SKILL.md) with references (Kimball primer, phase playbook, schema guide, deliverables) and a stakeholder interview guide (#28–#30).
- Plugin marketplace packaging (`.claude-plugin/marketplace.json`, `plugin/.claude-plugin/plugin.json`) and an install guide (#31).
- Skill evaluation scenarios with a fixture project (#32).

- Playwright end-to-end tests: full wizard flow offline, live sync both ways, conflict resolution (#33).
- Accessibility: axe checks (WCAG 2.1 AA, serious/critical) on every phase in light and dark themes; keyboard-operable bus matrix; focusable scroll regions; contrast fixes (#34).
- Hosted UI at [kimball.kristinn.eu](https://kimball.kristinn.eu), deployed by the GitHub Pages workflow (gated on the `DEPLOY_PAGES` repository variable), with Open Graph tags for link previews (#35).
- Release workflow (tag `v*` → GitHub release with the skill zip; manual dry run), `scripts/bump-version.mjs`, draft v1.0.0 release notes, and PNG renders of the brand assets (#36).

- Help page in the UI (`#/help`, the **?** button): what the process delivers and why (outcomes, every deliverable with live samples, what comes next), the ten phases, ways to use it, CLI reference, saving and privacy, glossary, validation rules, shortcuts and FAQ (#45).
- Guided demos with a step-by-step demo bar that ticks off steps as you do them: tour a finished model, model your first business process, share the results, work with Claude (#46).
- User guide (`docs/USER-GUIDE.md`) and skill reference (`references/user-guide.md`) generated from the same help content by `npm run build:docs`; a test fails if they are stale (#47).

- Phase 11 *Prototype* in a new *Build* stage: the design becomes a physical star schema (surrogate and business keys, type 2/3 history columns, a foreign key per role, degenerate dimensions as fact columns) filled with seeded sample data; an explorer groups facts by any dimension attribute, warns when a semi- or non-additive fact is summed, and shows the matching SQL; a table browser shows columns and sample rows and lets you set data types, business keys and sample values per attribute (#52).
- CREATE TABLE scripts for PostgreSQL, SQL Server and Snowflake with keys, constraints and index recommendations (FK indexes, business-key uniqueness, columnstore, BRIN, partitioning, clustering, grain uniqueness), each with its reason; `kimball ddl` (#53).
- A Docker Compose PostgreSQL sandbox with the tables and sample data loaded on first start, plus scripts, CSVs, example queries and index recommendations: download it from the UI or write it with `kimball prototype` (#52).
- The skill guides Claude through the prototype: suggest realistic sample values, business keys and data types for the user's domain, generate the bundle, start the sandbox and answer requirements with SQL (`references/prototype-guide.md`) (#52).
- Optional project-file fields: `physical` (dialect, seed, sample dates and row counts), attribute `dataType`, `businessKey` and `sampleValues`, fact `dataType` and `sampleRange`.
- Business owner, open-question owner and sponsor offer the project's stakeholders in a combobox, and a new name can be added as a stakeholder in one click; stakeholder cards show what each person owns (#51).

### Changed
- The coach panel button now uses a lightbulb icon; **?** opens Help.
- Text areas grow with their content; assumptions and open questions are full width, so long text is readable (#49).
- Example text in empty fields varies per item and follows the process or dimension name (#50).
- Removing a process, dimension, stakeholder or requirement offers Undo; only a just-added item takes focus; the bus matrix keeps its column order while you edit; a bubble opens its dimension (#54).
- Requirement traceability to the prototype (#58): save the explorer question that answers each requirement (`requirements[].query`, stored by id, so renaming a process, fact, dimension or attribute keeps it). The Prototype phase lists which requirements are answered, which aren't, and which saved queries no longer match the design. The requirements document gets an *Answered by* column, `queries.sql` starts with each requirement's SQL, and two new rules check them: KD109 (a saved query no longer matches the design) and KD206 (a must-have isn't answered yet). The examples answer some of their requirements.

### Fixed
- Pluralisation in phase details ("business processes").
- Review feedback on the core engine (wrapping, CSV formula injection, Markdown HTML escaping, id sanitising, duplicate roles, review status, blank scores). Degenerate dimensions are no longer counted as conformed.
- Full product review (#54):
  - Live sync never saves over a project file it could not read, retries failed saves instead of showing them as saved, queues saves, and re-checks for typing before applying an outside edit; redo is cleared when the project is replaced, so it can't undo Claude's edit.
  - `kimball serve` answers oversized saves with 413 instead of resetting the connection, rejects JSON that isn't a project with 422, accepts any Content-Type case and port 80, reads the file and its time stamp consistently, and uses unique temp files.
  - The requirements document escapes user text in headings, lists and code spans, and no longer marks degenerate dimensions as conformed there; SVG exports drop control characters; text wrapping never splits emoji; bus matrix CSV opens correctly in Excel.
  - Removing a stakeholder unlinks it from requirements; dangling references can be removed in the UI.
  - UI polish (#56): bubbles open their dimension from the keyboard; the bubble legend no longer overlaps or gets clipped; on phones the header fits, the page no longer scrolls sideways and the stepper is one compact row; Escape closes the coach overlay on narrower screens; full height on iOS; processes with the same scores get separate labels on the prioritisation grid; the save status only announces problems to screen readers; chip groups have labels.
  - Keyboard and accessibility: the Project menu supports arrow keys and Escape, focus moves to the new phase on navigation, Ctrl+Z works after ticking a checkbox, tags can't be duplicated or lost to Backspace auto-repeat, copy failures and errors are announced, and dark-mode status colours keep readable text.
