# kimball-designer skill evaluations

Realistic prompts with expected behaviour, used to check that the skill coaches well, follows Kimball practice and keeps the project file valid.

| Eval | What it checks |
|---|---|
| `new-project-kickoff` | Starts with purpose and sponsor, offers the UI, asks ≤ 3 questions, doesn't invent facts |
| `resume-existing-project` | Uses `kimball summary` and resumes at the right phase |
| `grain-coaching` | Pushes for an atomic, "One row per …" grain and records it |
| `conformed-dimensions` | Reuses dimensions, models dates as roles, keeps the file valid |
| `vague-request-bus-matrix` | Handles a vague ask without passing off examples as the user's facts |
| `conflicting-stakeholders` | Treats definitions as conformance questions; records open questions |
| `deliver` | Validates, renders, and gives a concise hand-off with a build-first recommendation |
| `no-node` | Falls back to Markdown/Mermaid when the CLI can't run |

## Running

**Manually:** start a fresh Claude Code session in a scratch folder with the plugin installed, copy the listed `files` in (fixtures go to `kimball/project.kimball.json`), send the `prompt`, and score each expectation pass/fail.

**With skill-creator:** the format follows the skill-creator `evals.json` convention (`prompt`, `files`, `expectations`), so it can drive automated runs and benchmarks.

After each run, also check the file mechanically:

```bash
node plugin/skills/kimball-designer/scripts/kimball.mjs validate kimball/project.kimball.json
```

A passing run leaves no KD00x errors.
