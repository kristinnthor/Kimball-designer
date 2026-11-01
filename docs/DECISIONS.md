# Architecture decision records

Short records of the decisions that shape Kimball Designer. New decisions are appended; superseded ones are marked, not deleted.

| # | Decision | Status | Date |
|---|---|---|---|
| 001 | A single project file is the source of truth | Accepted | 2026-11-01 |
| 002 | One shared TypeScript core for UI and CLI | Accepted | 2026-11-01 |
| 003 | React + Vite + TypeScript UI, built to a single offline HTML file | Accepted | 2026-11-01 |
| 004 | Zero-dependency CLI bundle committed to the skill, guarded by CI | Accepted | 2026-11-01 |
| 005 | Live sync via a localhost HTTP server and polling | Accepted | 2026-11-01 |
| 006 | Distribute as a Claude Code plugin marketplace + standalone skill | Accepted | 2026-11-01 |
| 007 | Custom SVG rendering for diagrams; Mermaid as a text format | Accepted | 2026-11-01 |
| 008 | MIT licence | Accepted (owner may change) | 2026-11-01 |
| 009 | Autonomous delivery workflow: issue → PR → green CI → squash-merge | Accepted | 2026-11-01 |
| 010 | GitHub Pages deployment is opt-in by the owner | Accepted | 2026-11-01 |

---

### ADR-001: A single project file is the source of truth

**Context.** Two very different front-ends (a chat agent and a web UI) must work on the same model, sometimes simultaneously.
**Decision.** All state lives in one human-readable JSON file, `*.kimball.json`, validated by a published JSON Schema. The bus matrix and bubble diagrams are *derived* from it and never stored.
**Consequences.** Easy to diff, review and commit next to the warehouse code. Claude can edit it with ordinary file tools. Schema changes need a `schemaVersion` bump and an upgrade step in `normalizeProject`.

### ADR-002: One shared TypeScript core for UI and CLI

**Decision.** Validation, derivations and exporters live in `src/core` with no DOM or Node imports. The UI and the CLI both call it.
**Consequences.** A diagram exported from the CLI is byte-identical to one exported from the UI. Core is unit-tested once.

### ADR-003: React + Vite + TypeScript UI, built to a single offline HTML file

**Context.** Skills are folders. Users may be offline or behind strict proxies; the UI must open from `file://` and from `kimball serve`.
**Decision.** React 19 + TypeScript, plain CSS on top of `brand/tokens.css`, no CSS framework, no web fonts, no CDN. `vite-plugin-singlefile` inlines everything into `ui/index.html`. Hash-based routing.
**Alternatives.** Svelte/Preact (smaller, but React is more familiar to contributors); a hosted-only app (breaks offline use).

### ADR-004: Zero-dependency CLI bundle committed to the skill, guarded by CI

**Decision.** `src/cli` is bundled with esbuild into `scripts/kimball.mjs` (ESM, Node ≥ 18, no `node_modules`). The built file is committed so the skill works immediately after install. CI rebuilds it and fails if it differs from the committed copy.
**Consequences.** Slightly noisy diffs in PRs that touch core; in exchange, no install step for skill users.

### ADR-005: Live sync via a localhost HTTP server and polling

**Decision.** `kimball serve` uses `node:http`, binds to `127.0.0.1`, validates Host/Origin, and the UI polls `/api/project/meta` every ~2 s.
**Alternatives.** WebSockets / file watchers pushing events — more moving parts and platform quirks (Windows file watching) for little benefit at this data size.

### ADR-006: Distribute as a Claude Code plugin marketplace + standalone skill

**Decision.** The repository root contains `.claude-plugin/marketplace.json`; the plugin lives in `plugin/` with the skill at `plugin/skills/kimball-designer/`. The same folder can be copied into `~/.claude/skills/` or zipped for Claude apps; releases attach that zip.

### ADR-007: Custom SVG rendering for diagrams; Mermaid as a text format

**Decision.** Bubble diagrams use a small deterministic radial layout and hand-built SVG themed with brand tokens. Mermaid `mindmap` output is offered for Markdown documents.
**Consequences.** No heavy diagram library, offline-safe, identical output in UI and CLI, testable geometry.

### ADR-008: MIT licence

**Decision.** MIT, chosen as the most permissive common default for a developer tool. The owner may change it before v1.0 — tracked in the runbook's "Decisions awaiting owner".

### ADR-009: Autonomous delivery workflow

**Context.** The owner asked Claude to plan and deliver the project with minimal interruptions while being able to monitor progress.
**Decision.** Every change is tied to an issue, made on a branch, opened as a PR with `Closes #N`, and squash-merged by the agent once CI is green. Anything that needs the owner (public publishing, licence, branding approval) is labelled `needs: owner decision` and listed in the runbook rather than done unilaterally.

### ADR-010: GitHub Pages deployment is opt-in

**Decision.** The Pages workflow exists but only deploys when the repository variable `DEPLOY_PAGES` is `true`. Publishing a public website is the owner's decision.
**Status.** Enabled by the owner on 2026-11-01 at the custom domain `kimball.kristinn.eu`. Pages is set to build from GitHub Actions, so the `CNAME` file in the repository root is informational only. The domain is configured in Settings → Pages.
