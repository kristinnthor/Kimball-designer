# Methodology

Kimball Designer implements the **requirements-to-high-level-model** part of the Kimball Lifecycle. This page explains the concepts the tool uses and how each one maps to a phase and to the project file.

## The journey

| Stage | Phase | Kimball concept | Output in the project file |
|---|---|---|---|
| Discover | 1. Kickoff | Program/project scope, sponsorship, success criteria | `meta` |
| | 2. Stakeholders | Business requirements interviews (business + IT) | `stakeholders[]` |
| | 3. Requirements | Analytic requirements, KPIs, business questions | `requirements[]`, `assumptions[]`, `openQuestions[]` |
| Model | 4. Business processes | Step 1 of the four-step design: **select the business process** | `processes[]` |
| | 5. Grain | Step 2: **declare the grain** (+ fact table type) | `processes[].grain`, `factTableType` |
| | 6. Dimensions | Step 3: **identify the dimensions** (conformed, role-playing) | `dimensions[]`, `processes[].dimensions[]` |
| | 7. Facts | Step 4: **identify the facts** (additivity) | `processes[].facts[]` |
| Deliver | 8. Bubble diagrams | High-level model ("bubble chart") per process | derived |
| | 9. Bus matrix | Enterprise data warehouse bus matrix | derived |
| | 10. Review & export | Validation, prioritisation, hand-off | exports |

## Key concepts

**Business process.** An operational activity that generates or captures measurable events — *taking an order*, *shipping*, *registering a claim*, *taking a monthly inventory snapshot*. Name processes as **events**, not departments ("Orders", not "Sales department") and not reports ("Monthly sales report").

**Grain.** Exactly what one row of the fact table represents, stated in business terms *before* choosing dimensions or facts: "One row per product on a scanned sales ticket line." Declaring the most **atomic** grain available keeps the model flexible.

**Fact table types.**
| Type | One row per… | Example |
|---|---|---|
| Transaction | event occurrence | order line, payment |
| Periodic snapshot | entity per period | account balance per month |
| Accumulating snapshot | process instance, updated as milestones occur | order fulfilment pipeline (ordered → shipped → delivered) |
| Factless | event or coverage with no numeric measure | student attendance, promotion coverage |

**Dimensions.** The "who, what, where, when, why, how" context for a measurement. A **conformed dimension** means the same thing (same keys, attributes and values) wherever it is used, which is what makes drilling across processes possible. A **role-playing dimension** is one physical dimension used in several roles (Date as *Order date* and *Ship date*).

**Facts and additivity.**
| Additivity | Can be summed across… | Example |
|---|---|---|
| Additive | all dimensions | sales amount, quantity |
| Semi-additive | some dimensions (not time) | account balance, inventory on hand |
| Non-additive | none — compute from additive parts | unit price, ratios, percentages |

**Bubble diagram (high-level model).** One per business process: the process/fact table in the centre, the dimensions around it. Kimball Designer adds the grain and fact table type as a caption and highlights conformed dimensions.

**Enterprise bus matrix.** Rows are business processes, columns are (conformed) dimensions, a mark means "this process uses this dimension". It is the blueprint for an incrementally built, integrated warehouse: implement one row at a time, reusing the conformed columns.

**Prioritisation grid.** Each process is scored for **business value** and **feasibility** (1–5). High-value, high-feasibility processes are the best first iterations.

## Validation rules

The validator encodes common review comments. Rule codes are stable so the skill and UI can reference them.

| Code | Severity | Rule |
|---|---|---|
| KD001 | error | Project has a name |
| KD002 | error | IDs are unique |
| KD003 | error | References point to existing items |
| KD101 | warning | Every process declares a grain |
| KD102 | warning | Every process has at least one dimension |
| KD103 | warning | Non-factless processes have at least one fact |
| KD104 | warning | Factless processes have no facts |
| KD105 | warning | Every dimension is used by at least one process |
| KD106 | warning | Every requirement is linked to a process |
| KD107 | warning | Names are unique (case-insensitive) |
| KD108 | warning | Every process has a date dimension |
| KD201 | info | Grain is phrased "One row per …" |
| KD202 | info | Dimension used by a single process (not yet conformed) |
| KD203 | info | Accumulating snapshots have ≥ 2 date roles |
| KD204 | info | Planned stakeholder interviews not done yet |
| KD205 | info | Process has no business value / feasibility score |

## Further reading

- Ralph Kimball & Margy Ross, *The Data Warehouse Toolkit* (3rd ed.), Wiley — chapters 1–3 and the "Kimball Dimensional Modeling Techniques" overview.
- Kimball et al., *The Data Warehouse Lifecycle Toolkit* (2nd ed.), Wiley — business requirements definition.
