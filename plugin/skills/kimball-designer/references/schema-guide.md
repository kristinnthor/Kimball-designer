# Project file guide (`*.kimball.json`, schema 1.0)

The project file is the single source of truth. The bus matrix and bubble diagrams are **derived** from `processes[].dimensions[]`; never store them. The formal schema is `schema/kimball-project.schema.json`.

## Shape

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/kristinnthor/Kimball-designer/main/plugin/skills/kimball-designer/schema/kimball-project.schema.json",
  "schemaVersion": "1.0",
  "meta": {
    "id": "prj_retail",
    "name": "Retail analytics",
    "purpose": "…business outcome…",
    "sponsor": "Dana Ortiz, VP Merchandising",
    "scopeIn": "…",
    "scopeOut": "…",
    "successCriteria": ["…", "…"],
    "currentPhase": "grain",          // kickoff|stakeholders|requirements|processes|grain|dimensions|facts|bubbles|matrix|review|prototype
    "createdAt": "2026-11-01T09:00:00.000Z",
    "updatedAt": "2026-11-01T09:00:00.000Z"
  },
  "stakeholders": [],
  "requirements": [],
  "processes": [],
  "dimensions": [],
  "assumptions": [],
  "openQuestions": [],
  "physical": { … }                   // optional, phase 11 prototype settings (see below)
}
```

## Entities

### Stakeholder
```json
{ "id": "sh_dana", "name": "Dana Ortiz", "role": "VP Merchandising", "department": "Merchandising",
  "type": "executive", "interviewStatus": "done", "notes": "Wants category growth and margin trends." }
```
- `type`: `executive` · `business` · `analyst` · `it` · `other`
- `interviewStatus`: `planned` · `done` · `skipped`

### Requirement
```json
{ "id": "rq_promo_lift", "statement": "Did a promotion increase sales, and did it cannibalise other products?",
  "kpis": ["Promotion lift", "Incremental margin"], "priority": "must",
  "stakeholderIds": ["sh_sam"], "processIds": ["bp_retail_sales"], "notes": "" }
```
- `priority`: `must` · `should` · `could` · `wont`
- `processIds` links the requirement to the processes that answer it (traceability). Set it in the processes phase.

### Business process
```json
{
  "id": "bp_retail_sales", "name": "Retail sales",
  "description": "Every item scanned at a checkout.", "owner": "Dana Ortiz", "sourceSystems": ["POS"],
  "grain": "One row per product scanned on a sales transaction line",
  "factTableType": "transaction",
  "businessValue": 5, "feasibility": 5,
  "facts": [
    { "id": "ms_net_sales", "name": "Net sales amount", "description": "", "additivity": "additive", "unit": "currency" }
  ],
  "dimensions": [
    { "dimensionId": "dm_date", "roles": [] },
    { "dimensionId": "dm_employee", "roles": ["Cashier"] }
  ]
}
```
- `factTableType`: `transaction` · `periodic-snapshot` · `accumulating-snapshot` · `factless` · `null` (not decided)
- `businessValue`, `feasibility`: integers 1–5 or `null`
- `additivity`: `additive` · `semi-additive` · `non-additive`
- `dimensions[].roles`: role names for role-playing dimensions; empty array for a single, unnamed role.
- Optional on a fact, for the prototype: `"dataType": "integer" | "decimal"` (otherwise inferred from name and unit) and `"sampleRange": [min, max]`.

### Dimension
```json
{
  "id": "dm_product", "name": "Product", "kind": "standard", "description": "Every SKU sold or stocked.",
  "attributes": [ { "id": "at_prod_brand", "name": "Brand", "description": "", "scdType": 2 } ],
  "hierarchies": ["SKU → Brand → Category → Department"]
}
```
- `kind`: `standard` · `date` · `degenerate` (a key with no attributes, e.g. order number) · `junk` (bundle of flags)
- `scdType`: `0` · `1` · `2` · `3` · `null` (not decided)
- Optional on an attribute, for the prototype (omit when unknown):
  - `"businessKey": true` — the source system's identifier (customer number, SKU).
  - `"dataType"`: `text` · `integer` · `decimal` · `date` · `boolean` (otherwise inferred from the name).
  - `"sampleValues": ["…", "…"]` — realistic example values for the sample data, agreed with the user.

### Prototype settings (optional)
```json
"physical": { "dialect": "postgres", "seed": 1, "dateFrom": "2025-01-01", "dateTo": "2025-12-31", "rows": { "bp_retail_sales": 5000 } }
```
- `dialect`: `postgres` · `sqlserver` · `snowflake` (target platform for the CREATE TABLE script).
- `seed`: the same seed gives the same sample rows. `rows`: sample rows per table, keyed by dimension or process id (1–100000).
- Leave `physical` out until the user changes a setting; the defaults are PostgreSQL and the calendar year before the project was created.

### Assumption / open question
```json
{ "id": "as_calendar", "text": "The fiscal calendar is 4-4-5." }
{ "id": "oq_returns", "text": "Who owns returns data?", "owner": "Elena Petrova", "status": "open" }
```
- `status`: `open` · `answered`

## Ids

- Unique across the whole file; letters, digits, `_`, `.`, `-` only.
- Use readable prefixes + slug: `sh_` stakeholder, `rq_` requirement, `bp_` business process, `dm_` dimension, `ms_` measure/fact, `at_` attribute, `as_` assumption, `oq_` open question.
- Never change an existing id — other items reference it and the UI may be open.

## Editing recipes

Always **re-read the file first** (the user may have edited it in the UI), make targeted edits, keep valid JSON, then run `$KD summary <file>`.

**Add a business process** — append to `processes`:
```json
{ "id": "bp_store_inventory", "name": "Store inventory", "description": "", "owner": "", "sourceSystems": ["ERP"],
  "grain": "", "factTableType": null, "businessValue": null, "feasibility": null, "facts": [], "dimensions": [] }
```

**Link a requirement to a process** — add the process id to `requirements[i].processIds`.

**Declare grain** — set `grain` (start with "One row per …") and `factTableType` on the process.

**Add a dimension and use it in two processes (conformed)** — append once to `dimensions`, then add `{ "dimensionId": "dm_customer", "roles": [] }` to each process's `dimensions`.

**Role-playing date** — one usage with several roles: `{ "dimensionId": "dm_date", "roles": ["Order date", "Ship date"] }`.

**Remove a dimension** — delete it from `dimensions` **and** remove every usage with that `dimensionId` from all processes (otherwise KD003).

**Remove a process** — delete it and remove its id from every `requirements[].processIds`.

**Move the UI to a phase** — set `meta.currentPhase`.

**Make the prototype data realistic** — on each agreed attribute add `"sampleValues": [...]` (and `"businessKey": true` on the source identifier), then run `$KD prototype <file>`.

## Tolerant loading

The CLI and UI normalise sloppy input: missing arrays become `[]`, unknown enum values fall back to defaults, a bare string in `processes[].dimensions` is read as `{ "dimensionId": "<string>", "roles": [] }`, invalid id characters become `_`. Unknown fields are dropped when the file is next saved. Still, write the canonical shape.
