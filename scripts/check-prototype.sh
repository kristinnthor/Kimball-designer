#!/usr/bin/env bash
# Runs a prototype bundle for real, the way its READMEs tell the user to:
# the Docker sandbox, queries.sql, and the dbt project against the sandbox.
# Usage: bash scripts/check-prototype.sh <example>   (needs Node, Docker, Python and dbt-postgres)
set -euo pipefail

example="$1"
cli="$PWD/plugin/skills/kimball-designer/scripts/kimball.mjs"
work="$(mktemp -d)"
node "$cli" init "$work/$example.kimball.json" --example "$example" > /dev/null
node "$cli" prototype "$work/$example.kimball.json" --out "$work/proto" > /dev/null
cd "$work/proto"

echo "::group::$example: sandbox"
docker compose up -d --wait
trap 'docker compose down -v > /dev/null 2>&1 || true' EXIT
sql() { docker compose exec -T db psql -U kimball -d kimball -v ON_ERROR_STOP=1 -X -q "$@"; }
value() { sql -A -t -c "$1"; }

# Every table has the rows of its CSV.
for csv in data/*.csv; do
  table="$(basename "$csv" .csv)"
  expected="$(python3 -c 'import csv, sys; print(sum(1 for _ in csv.reader(open(sys.argv[1], encoding="utf-8-sig", newline=""))) - 1)' "$csv")"
  actual="$(value "SELECT count(*) FROM $table")"
  if [ "$actual" != "$expected" ]; then
    echo "::error::$example: $table has $actual rows in the sandbox, $expected in its CSV"
    exit 1
  fi
  echo "$table: $actual rows"
done
sql -o /dev/null -f - < queries.sql
echo "queries.sql runs"
echo "::endgroup::"

echo "::group::$example: dbt"
cd dbt
dbt debug
dbt seed
dbt run
dbt test
dbt compile
dbt docs generate > /dev/null
# The analyses compile to plain SQL that runs against the models.
for analysis in target/compiled/*/analyses/*.sql; do
  [ -e "$analysis" ] || continue
  sql -o /dev/null -f - < "$analysis"
  echo "ran $(basename "$analysis")"
done
# The models built from the seeds hold the same rows as the sandbox's tables, with the same column types.
for csv in ../data/*.csv; do
  table="$(basename "$csv" .csv)"
  diff="$(value "SELECT count(*) FROM ((TABLE public.$table EXCEPT ALL TABLE analytics.$table) UNION ALL (TABLE analytics.$table EXCEPT ALL TABLE public.$table)) AS d")"
  if [ "$diff" != "0" ]; then
    echo "::error::$example: the dbt model $table differs from the sandbox table in $diff rows"
    exit 1
  fi
done
echo "the dbt models match the sandbox tables"
echo "::endgroup::"
