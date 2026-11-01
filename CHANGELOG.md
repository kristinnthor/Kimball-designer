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
