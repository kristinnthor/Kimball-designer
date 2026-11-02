# Phase playbook

How to run each phase in conversation. `$KD guide <phase>` gives the coaching notes (why, what to ask, tips, pitfalls); this playbook adds **how to drive the conversation, what to record and how to handle common situations**.

General pattern per phase: set `meta.currentPhase` → ask ≤ 3 questions → record → read back in one line → `$KD summary` → next.

---

## 1 · Kickoff (`kickoff`)

**Done when:** `meta.name`, `meta.purpose` and `meta.scopeIn` are filled.

Open with: *"In one or two sentences, what decisions should this warehouse help people make — and who is sponsoring it?"*

- Rewrite technology-led purposes as business outcomes and confirm: "build a Snowflake lakehouse" → "give finance a trusted daily margin view".
- Ask for out-of-scope items explicitly; they prevent scope creep later.
- Success criteria: two or three, measurable.

**Situation — the user has no sponsor.** Record `sponsor: ""`, add an open question "Who sponsors this program?" and continue; flag it again at review.

## 2 · Stakeholders (`stakeholders`)

**Done when:** at least one stakeholder exists, no interview is still `planned`, and at least one is `done`.

- Aim for a balanced list: executive, business managers, analysts/power users, IT/source owners.
- If the user *is* the only stakeholder (common for solo developers), record them as `analyst` or `business`, mark `done`, and note that more interviews would strengthen the model.
- If interviews are still to happen, produce an interview pack from `references/interview-guide.md` tailored to each person, and mark them `planned`. Come back to record notes.

## 3 · Requirements (`requirements`)

**Done when:** at least one requirement exists.

- Ask for the top three questions people can't answer today. One question per requirement, in the stakeholder's words.
- Pull KPIs into `kpis` — they become facts later.
- Use MoSCoW priority; push back gently if everything is "must".
- Anything uncertain → `openQuestions`; anything taken as given → `assumptions`.

**Situation — the user lists reports, not questions.** Ask "what decision does this report support?" and record the decision/question.

## 4 · Business processes (`processes`)

**Done when:** at least one process exists. (Traceability and scoring are checked by validation.)

- For each requirement ask: *"Which business event produces the data to answer this?"* Group requirements by event.
- Name processes as **events or activities**: "Retail sales", "Claims submitted", "Monthly account balances". Not "Sales department", not "Weekly report".
- Record owner and source systems; link `requirements[].processIds`.
- Score `businessValue` and `feasibility` 1–5 together with the user. Feasibility is mostly about data availability and quality.

**Situation — one "process" mixes different events** (orders and shipments). Split it: different events usually mean different grains.
**Situation — the user asks for suggestions.** Offer 3–6 typical processes for their domain, clearly marked as suggestions, and record only the ones they accept.

## 5 · Grain (`grain`)

**Done when:** every process has a `grain` and a `factTableType`.

- Ask: *"What is one row? The most detailed level the source captures."*
- Write it as "One row per …". Read it back and confirm.
- Choose the fact table type: event at a point in time → transaction; level or balance per period → periodic snapshot; lifecycle with milestones → accumulating snapshot; event without numbers → factless.
- Prefer atomic grain; summaries can be built later.

**Situation — two measures at different grains** (order header freight vs order line amount). Either allocate to the lower grain or model a second process. Explain the trade-off briefly; let the user decide.

## 6 · Dimensions (`dimensions`)

**Done when:** every process has at least one dimension.

- For one row at the declared grain ask **who, what, where, when, why, how**. Turn each answer into a dimension.
- **Reuse before you create:** if a Customer dimension already exists, use it in this process too — that is what makes it conformed. Check names that differ only in wording (Client vs Customer).
- Dates playing several roles → one Date dimension with `roles`.
- Order/invoice/ticket numbers with no attributes → `kind: "degenerate"`.
- Many small flags → one `junk` dimension.
- Capture key attributes and which ones need history (`scdType: 2`) only if the user knows; otherwise leave `null`.

**Situation — the user wants to model every source column as a dimension.** Bring it back to "what do people filter, group or label by?"

## 7 · Facts (`facts`)

**Done when:** every non-factless process has at least one fact.

- Ask: *"What numbers does this event produce at this grain?"* Cross-check with the KPIs from requirements.
- Mark additivity: amounts and counts are additive; balances and levels are semi-additive; prices, ratios and percentages are non-additive (store the parts).
- Facts that don't exist at this grain belong to another process.

## 8 · Bubble diagrams (`bubbles`)

**Done when:** every process has dimensions (diagrams are derived).

- Run `$KD render` or point the user at the UI's Bubble diagrams phase.
- Walk through one process at a time: "Can you answer your questions by combining these dimensions? Anything missing?" Record changes.

## 9 · Bus matrix (`matrix`)

**Done when:** every dimension is used by at least one process.

- Show `kimball/out/bus-matrix.md` (or `$KD render` first).
- Discuss columns used by one process only (KD202): should another process share them?
- Agree owners for the most-shared (conformed) dimensions — record as open questions if unknown.
- Sort by priority to propose the delivery order.

## 10 · Review & export (`review`)

**Done when:** no errors and no warnings.

- `$KD validate <file>`; fix errors, address warnings, mention notes.
- Review open questions: which block the first iteration?
- `$KD render <file> --out kimball/out` and give the hand-off message (`references/deliverables.md`).
- Suggest next steps: detailed dimension design (attributes, SCD strategy), source-to-target mapping, then build the first fact table.
- Offer the prototype (phase 11) to try the design with data first.

## 11 · Prototype (`prototype`)

**Done when:** every process has a grain, at least one dimension, and facts (or is factless), so it can be built as a table.

- Ask which platform they target; record it in `physical.dialect` only if they choose something other than PostgreSQL.
- Propose business keys, data types and realistic sample values per attribute; record what the user accepts (`references/prototype-guide.md`).
- `$KD prototype <file> --out kimball/prototype`; with Docker and the user's go-ahead, `docker compose up -d` and run a few requirement queries.
- Typical situations:
  - *"Is this real data?"* — No: made-up rows that test the structure. Say so whenever you show results.
  - *A requirement can't be answered* — that is a design finding: a missing dimension, attribute or fact, or the wrong grain. Go back to that phase.
  - *"Which indexes do we need?"* — Walk through `index-recommendations.md`: keys now, columnstore/BRIN/partitioning when the tables are large.
