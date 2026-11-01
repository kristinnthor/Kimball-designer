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

### Fixed
- Pluralisation in phase details ("business processes").
- Review feedback on the core engine (wrapping, CSV formula injection, Markdown HTML escaping, id sanitising, duplicate roles, review status, blank scores). Degenerate dimensions are no longer counted as conformed.
