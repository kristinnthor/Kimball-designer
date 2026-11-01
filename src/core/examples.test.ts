import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import { EXAMPLES, loadExample } from './examples';
import { serializeProject } from './normalize';
import { createProject } from './model';
import { validateProject } from './validate';
import { tinyProject } from './test-helpers';

const schema = JSON.parse(readFileSync(new URL('./schema/kimball-project.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validateSchema = ajv.compile(schema);

describe('example projects', () => {
  it.each(EXAMPLES.map((e) => e.id))('%s has no errors or warnings', (id) => {
    const findings = validateProject(loadExample(id)).filter((f) => f.severity !== 'info');
    expect(findings).toEqual([]);
  });

  it.each(EXAMPLES.map((e) => e.id))('%s conforms to the JSON Schema as written and as serialised', (id) => {
    const raw = JSON.parse(readFileSync(new URL(`./examples/${id}.kimball.json`, import.meta.url), 'utf8'));
    expect(validateSchema(raw), JSON.stringify(validateSchema.errors)).toBe(true);
    expect(validateSchema(JSON.parse(serializeProject(loadExample(id)))), JSON.stringify(validateSchema.errors)).toBe(
      true,
    );
  });

  it('keeps the readable ids from the file', () => {
    expect(loadExample('retail').processes[0]!.id).toBe('bp_retail_sales');
  });
});

describe('JSON Schema', () => {
  it('accepts new and serialised projects', () => {
    expect(validateSchema(JSON.parse(serializeProject(createProject('x'))))).toBe(true);
    expect(validateSchema(JSON.parse(serializeProject(tinyProject())))).toBe(true);
  });

  it('rejects unknown fields and bad enums', () => {
    const p = JSON.parse(serializeProject(tinyProject()));
    p.processes[0].factTableType = 'weekly';
    expect(validateSchema(p)).toBe(false);
    const q = JSON.parse(serializeProject(tinyProject()));
    q.extra = 1;
    expect(validateSchema(q)).toBe(false);
  });
});
