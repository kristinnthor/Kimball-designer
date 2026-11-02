# Prototype guide (phase 11)

The prototype turns the agreed high-level design into a **physical star schema with made-up sample data**, so the team can query it before anything is built, and hands over a **CREATE TABLE script with index recommendations**. It is optional and comes after phase 10.

## What `$KD prototype` and `$KD ddl` produce

`$KD prototype <file> --out kimball/prototype [--dialect postgres|sqlserver|snowflake] [--seed N] [--rows N]` writes:

| File | What |
|---|---|
| `docker-compose.yml` | PostgreSQL 17 sandbox on `127.0.0.1:5433`, database and user `kimball`, no password (local only) |
| `initdb/01-schema.sql`, `initdb/02-data.sql` | PostgreSQL DDL and INSERTs, loaded by the sandbox on first start |
| `schema.sql` | DDL for the chosen dialect (the target platform) |
| `data.<dialect>.sql` | INSERTs for the chosen dialect when it isn't PostgreSQL |
| `index-recommendations.md` | Keys and indexes, now and later, with the reason for each |
| `queries.sql` | The saved query for each answered requirement, then one example star-join query per fact table, plus one by period |
| `data/*.csv` | Every table's sample rows (UTF-8 with BOM) |

`$KD ddl <file> [--dialect …] [--drop] [--out file]` prints or writes just the CREATE TABLE script.

## Conventions the generator follows

- One table per dimension `dim_<name>`; degenerate dimensions become a column on the fact table instead.
- Integer **surrogate key** `<name>_key` (identity / autoincrement); date dimensions use a `yyyymmdd` integer key and a `full_date` column, plus standard calendar columns when the design lists no attributes.
- **Business key**: the attribute marked `businessKey: true`, else one named like `… id`, `… number`, `… code`, `SKU`, else a first attribute with SCD type 0; if none, a `<name>_code` column is added (marked *added*).
- **Type 2** attributes add `row_effective_date`, `row_expiration_date`, `is_current_row`; **type 3** adds `prior_<column>`.
- One table per process `fact_<name>`: one foreign key per dimension **role** (`order_date_key`, `bill_to_customer_key`), then the facts. Types come from the unit and name (currency → decimal(18,2), counts → integer, percentages → decimal(9,4), durations → decimal(12,2)); `dataType` overrides.
- Names are snake_case ASCII (Icelandic and other letters are transliterated); reserved words get the table's subject as prefix (`group` → `customer_group`).

## Index recommendations (why, per dialect)

| Dialect | Now | Later (commented out) |
|---|---|---|
| PostgreSQL | PK per dimension; unique business key (type 2: unique current row + unique key and start date); a B-tree index per fact foreign key and degenerate column | BRIN on the main date key, partitioning by date, unique grain index for periodic snapshots, instance key for accumulating snapshots |
| SQL Server | Clustered PK per dimension; filtered unique business key; clustered columnstore per fact table | Nonclustered date index, partitioning, grain uniqueness |
| Snowflake | Informational PK/FK only (not enforced) | Clustering key on the date key for very large tables; search optimization for business-key lookups |

Explain the *why* in one line when you hand it over; the reasons are in the script comments and `index-recommendations.md`.

## How Claude helps

1. **Confirm the design is ready.** `$KD summary <file>` shows "N of M fact tables ready to build" for phase 11. A process needs a grain, at least one dimension, and facts (or `factTableType: "factless"`).
2. **Make the data look like the business.** Propose, per dimension, which attribute is the business key, data types where the name is ambiguous, and **5–15 realistic sample values** per descriptive attribute (category names, regions, plan names). Sample values are *example data*, not business facts, but they should be plausible for the user's domain: say they are suggestions and record them only after the user agrees. Use the user's language and terminology. Keep hierarchies consistent (each brand in one category).
3. **Record** them in the project file: `attributes[].sampleValues`, `businessKey`, `dataType`, and `facts[].sampleRange` (`[min, max]`) for measures with a known range. Optionally set `physical` (dialect, dates, seed, row counts).
4. **Answer the requirements.** For each must-have requirement, propose the question that answers it, in words: the business process, the measure and how to aggregate it (sum for additive facts; average, minimum or maximum for semi- and non-additive ones, or group a balance by date), up to two dimension attributes to group by (with the role for role-playing dimensions) and at most one filter. Record it as `requirements[].query` after the user agrees (shape in `schema-guide.md`), then run `$KD validate <file>`: KD109 flags a query that doesn't match the design, KD206 lists must-haves still unanswered. If no query can answer a must-have, say what is missing (a dimension, an attribute or a fact): that is a gap in the design, which is the point of the prototype.
5. **Generate**: `$KD prototype <file> --out kimball/prototype`. `queries.sql` starts with the SQL for each answered requirement. If Docker is available and the user agrees, run `docker compose up -d` in that folder, then run those queries through `docker compose exec -T db psql -U kimball -d kimball -c "<query>"` and show the results.
6. **Hand over**: the path to `schema.sql` for their platform, the three most important index recommendations, and what to review before the real build (data types, text lengths, business keys, an *Unknown* row per dimension).

## Rules

- Never present sample rows as real data or draw business conclusions from them; they test the **structure**.
- Don't overwrite user-entered sample values without asking.
- The sandbox listens on `127.0.0.1` only and needs no password; don't expose it elsewhere.
