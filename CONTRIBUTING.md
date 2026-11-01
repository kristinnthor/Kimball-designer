# Contributing to Kimball Designer

Thanks for helping! This guide covers setup, conventions and how work is organised.

## Setup

Requirements: **Node 20+** and npm.

```bash
git clone https://github.com/kristinnthor/Kimball-designer.git
cd Kimball-designer
npm ci
npm run dev        # guided UI with hot reload
npm run check      # typecheck + tests + builds, same as CI
```

## Where things live

| Change | Edit | Then |
|---|---|---|
| Model, validation, exporters | `src/core/` | add/adjust tests in `src/core/*.test.ts` |
| UI | `src/app/` | screenshot in the PR |
| CLI / sync server | `src/cli/` | tests in `src/cli/*.test.ts` |
| Skill instructions & references | `plugin/skills/kimball-designer/` (Markdown files only) | — |
| Anything under `src/` | — | run `npm run build:skill` and commit the rebuilt `ui/index.html` and `scripts/kimball.mjs` |

Never edit `plugin/skills/kimball-designer/ui/index.html`, `scripts/kimball.mjs`, `schema/` or `examples/` by hand — they are build outputs.

## Conventions

- **TypeScript strict**; no `any` without a comment explaining why.
- **Core is pure**: no DOM, no Node APIs in `src/core`.
- **Brand**: use tokens from `brand/tokens.css`; follow the voice rules in [BRAND.md](brand/BRAND.md) for any user-facing text.
- **Commits**: Conventional Commits with the issue number — `feat(ui): grain phase (#19)`.
- **Branches**: `feat/<issue>-<slug>`, `fix/…`, `docs/…`, `chore/…`.

## Workflow

Every change starts from an issue and lands through a PR that says `Closes #N`. CI must be green; PRs are squash-merged. The full process, labels and definition of done are in the [runbook](docs/RUNBOOK.md).

## Methodology questions

If you're unsure whether something is "Kimball-correct", check [docs/METHODOLOGY.md](docs/METHODOLOGY.md) and the skill's `references/kimball-primer.md`, and say what you assumed in the PR.
