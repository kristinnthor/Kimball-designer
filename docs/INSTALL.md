# Installing Kimball Designer

Kimball Designer ships as a **Claude Code plugin** containing one skill, `kimball-designer`. The skill folder is self-contained: the CLI (`scripts/kimball.mjs`) and the guided UI (`ui/index.html`) are bundled, so nothing needs `npm install`. You only need **Node.js 18+** for the CLI and live sync.

## Option 1 — Claude Code plugin marketplace (recommended)

In Claude Code:

```text
/plugin marketplace add kristinnthor/Kimball-designer
/plugin install kimball-designer@kimball-designer
```

From a shell, the equivalent is:

```bash
claude plugin marketplace add kristinnthor/Kimball-designer
```

```bash
claude plugin install kimball-designer@kimball-designer
```

Pin a release with `kristinnthor/Kimball-designer#v1.0.0`. Update later with `/plugin marketplace update kimball-designer`.

## Option 2 — copy the skill folder

Copy `plugin/skills/kimball-designer/` to one of:

| Scope | Location |
|---|---|
| Personal (all projects) | `~/.claude/skills/kimball-designer/` |
| One project (shared with the team via git) | `<project>/.claude/skills/kimball-designer/` |

## Option 3 — Claude apps (claude.ai / desktop)

Download `kimball-designer-skill-<version>.zip` from the [latest release](https://github.com/kristinnthor/Kimball-designer/releases), then upload it under **Settings → Capabilities → Skills**. The zip contains the `kimball-designer/` folder with `SKILL.md` at its top. The live-sync UI needs a local Node.js process, so in Claude apps the skill works in chat mode and with the offline UI file.

## Check that it works

Ask Claude:

> Help me gather requirements for a sales data warehouse and build a bus matrix.

Claude should create `kimball/project.kimball.json`, offer to open the guided UI, and start with purpose and sponsor questions.

Or try the CLI directly:

```bash
node ~/.claude/skills/kimball-designer/scripts/kimball.mjs init demo.kimball.json --example retail
```

```bash
node ~/.claude/skills/kimball-designer/scripts/kimball.mjs serve demo.kimball.json --open
```

## Using the UI without Claude

- **Offline:** open `plugin/skills/kimball-designer/ui/index.html` in a browser. Projects autosave in the browser; use *Project → Export* to save a `.kimball.json` file.
- **With a file on disk:** `kimball serve <file>` opens the UI on that file with live sync.
- **Hosted:** if the owner enables GitHub Pages (#35), the same UI is available online.

## Uninstall

`/plugin uninstall kimball-designer@kimball-designer` (and `/plugin marketplace remove kimball-designer`), or delete the copied skill folder.
