# Kimball primer

The concepts this skill uses, each in a few lines you can paraphrase to the user. Explain a term the first time it matters, not up front.

## The four-step dimensional design

1. **Select the business process** — an operational event that produces measurements.
2. **Declare the grain** — exactly what one fact row represents.
3. **Identify the dimensions** — the descriptive context of each row.
4. **Identify the facts** — the numeric measurements at that grain.

Grain comes before dimensions and facts. If a candidate dimension or fact doesn't fit the grain, either the grain is wrong or it belongs to another process.

## Business process

An activity the organisation performs that generates or captures events: taking an order, shipping, invoicing, paying a claim, a monthly balance. Each becomes at least one fact table and one row of the bus matrix. Named as events ("Retail sales"), not departments ("Merchandising") or reports ("Weekly sales pack").

## Grain

"One row per product scanned on a sales transaction line." State it in business terms. Prefer the **atomic** grain — the most detailed the source captures — because it answers questions nobody has asked yet; aggregates can be built from it.

## Fact table types

| Type | One row per… | Typical facts | Example |
|---|---|---|---|
| Transaction | event at a point in time | amounts, quantities | order line, payment |
| Periodic snapshot | entity per regular period | balances, levels (semi-additive) | inventory per product per store per day |
| Accumulating snapshot | process instance, updated at milestones | lags between milestones, counts | order from placed → shipped → delivered |
| Factless | event or coverage without measures | (row count) | attendance, promotion coverage |

Accumulating snapshots have several date roles (one per milestone).

## Dimensions

Descriptive context: **who, what, where, when, why, how**. Rich, verbose attributes people filter, group and label by.

- **Conformed dimension** — the same dimension (same keys, attributes, values) used by several processes. It is what lets you compare and "drill across" processes. Build once, reuse everywhere.
- **Role-playing dimension** — one dimension used in several roles: Date as Order date and Ship date; Provider as Rendering and Billing provider. Model with `roles`, not separate dimensions.
- **Degenerate dimension** — an identifier with no attributes kept in the fact table: order number, invoice number. Never conformed.
- **Junk dimension** — low-cardinality flags and codes grouped into one dimension.
- **Slowly changing dimensions (SCD)** — how attribute changes are handled: type 0 keep original, type 1 overwrite, type 2 new row with history, type 3 previous-value column.
- **Date dimension** — almost every fact table has at least one.

## Facts and additivity

| Additivity | Summable across… | Examples | Note |
|---|---|---|---|
| Additive | every dimension | sales amount, quantity, lag in days | Best kind of fact |
| Semi-additive | some dimensions, not time | account balance, inventory on hand | Average or take period-end over time |
| Non-additive | none | unit price, margin %, ratios, distinct counts | Store the additive components instead |

## Bubble diagram (high-level model)

One per business process. The process in the centre, its dimensions as bubbles around it, the grain written underneath. In this tool, conformed dimensions are amber, degenerate ones dashed, and a facts panel lists the measures with additivity. It is the right level for business review — before any table design.

## Enterprise bus matrix

Rows: business processes. Columns: dimensions. A mark: the process uses the dimension. Columns used by many rows are the most valuable conformed dimensions — agree their definitions and ownership first. Rows are delivered one iteration at a time, in priority order, each reusing the conformed columns already built.

## Prioritisation

Score each process 1–5 for **business value** and **feasibility** (data availability, quality, complexity). High-value, high-feasibility processes go first. Score = value × feasibility (1–25).

## Validation rules

| Code | Severity | Rule | Typical fix |
|---|---|---|---|
| KD001 | error | Project has a name | Ask for a short name |
| KD002 | error | Ids are unique | Rename the duplicate id |
| KD003 | error | References point to existing items | Remove the stale reference or add the item |
| KD101 | warning | Every process declares a grain | Phase 5 |
| KD102 | warning | Every process has a dimension | Phase 6 |
| KD103 | warning | Non-factless processes have facts | Phase 7, or mark factless |
| KD104 | warning | Factless processes have no facts | Change type or remove facts |
| KD105 | warning | Every dimension is used | Assign it or remove it |
| KD106 | warning | Every requirement links to a process | Link it, or a process is missing |
| KD107 | warning | Names are unique | Rename or merge |
| KD108 | warning | Every process has a date dimension | Add Date (with a role) |
| KD201 | info | Grain phrased "One row per …" | Rephrase |
| KD202 | info | Dimension used by one process only | Check whether others share it |
| KD203 | info | Accumulating snapshot has < 2 date roles | Add a role per milestone |
| KD204 | info | Planned interviews not done | Mark done/skipped |
| KD205 | info | Process not scored | Score value and feasibility |

## Further reading

Kimball & Ross, *The Data Warehouse Toolkit* (3rd ed.), chapters 1–3; Kimball et al., *The Data Warehouse Lifecycle Toolkit* (2nd ed.), business requirements definition.
