import { AGGREGATES, groupKey, groupOptions, type ExploreQuery, type GroupBy } from './explore';
import {
  dimensionById,
  displayName,
  processById,
  type KimballProject,
  type QueryColumn,
  type Requirement,
  type RequirementQuery,
} from './model';
import { attributeIdOf, physicalModel, type PhysicalModel } from './physical';

/**
 * Requirement → query traceability: the prototype question that shows the design
 * answers a requirement. Saved in design terms (see RequirementQuery) and turned
 * back into an explorer query against the current physical model.
 */

/** The explorer query in design terms, or null when it uses a column the design can't name. */
export function toRequirementQuery(model: PhysicalModel, query: ExploreQuery): RequirementQuery | null {
  const fact = model.tables.find((t) => t.kind === 'fact' && t.name === query.fact);
  if (!fact) return null;
  const column = (g: GroupBy): QueryColumn | null => {
    const c = fact.columns.find((x) => x.name === g.column);
    if (c?.source.kind === 'degenerate') return { dimensionId: c.source.dimensionId };
    if (c?.source.kind !== 'usage' || !g.attribute) return null;
    const a = model.tables.find((t) => t.name === c.references?.table)?.columns.find((x) => x.name === g.attribute);
    if (!a) return null;
    const attributeId = attributeIdOf(a);
    return {
      dimensionId: c.source.dimensionId,
      ...(c.source.role ? { role: c.source.role } : {}),
      ...(attributeId ? { attributeId } : { column: a.name }),
    };
  };
  const measure = fact.columns.find((c) => c.name === query.measure);
  const measureId = measure?.source.kind === 'measure' && query.aggregate !== 'count' ? measure.source.measure.id : undefined;
  const groupBy = query.groupBy.map(column);
  if (groupBy.some((g) => !g)) return null;
  const out: RequirementQuery = {
    processId: fact.sourceId,
    ...(measureId ? { measureId } : {}),
    aggregate: measureId ? query.aggregate : 'count',
    groupBy: groupBy as QueryColumn[],
  };
  if (query.filter) {
    const by = column(query.filter.by);
    if (!by) return null;
    out.filter = { column: by, value: query.filter.value };
  }
  return out;
}

/** The saved query as an explorer query, or null when it no longer matches the design. */
export function fromRequirementQuery(model: PhysicalModel, query: RequirementQuery): ExploreQuery | null {
  const fact = model.tables.find((t) => t.kind === 'fact' && t.sourceId === query.processId);
  if (!fact) return null;
  const options = new Set(groupOptions(model, fact).map((o) => o.key));
  const by = (q: QueryColumn): GroupBy | null => {
    let g: GroupBy | undefined;
    if (!q.attributeId && !q.column) {
      const c = fact.columns.find((x) => x.source.kind === 'degenerate' && x.source.dimensionId === q.dimensionId);
      g = c && { column: c.name };
    } else {
      const fk = fact.columns.find(
        (x) => x.source.kind === 'usage' && x.source.dimensionId === q.dimensionId && (x.source.role ?? '') === (q.role ?? ''),
      );
      const dim = fk && model.tables.find((t) => t.name === fk.references?.table);
      const a = dim?.columns.find((x) => (q.attributeId ? attributeIdOf(x) === q.attributeId : x.name === q.column && !attributeIdOf(x)));
      g = fk && a && { column: fk.name, attribute: a.name };
    }
    return g && options.has(groupKey(g)) ? g : null;
  };
  let measure: string | null = null;
  if (query.aggregate !== 'count') {
    const m = fact.columns.find((c) => c.source.kind === 'measure' && c.source.measure.id === query.measureId);
    if (!m) return null;
    measure = m.name;
  }
  const groupBy = query.groupBy.map(by);
  if (groupBy.some((g) => !g)) return null;
  const filterBy = query.filter ? by(query.filter.column) : null;
  if (query.filter && !filterBy) return null;
  return {
    fact: fact.name,
    measure,
    aggregate: query.aggregate,
    groupBy: groupBy as GroupBy[],
    filter: filterBy ? { by: filterBy, value: query.filter!.value } : null,
    limit: 20,
  };
}

/** The query in words, with the design's names: "Retail sales: sum of Net sales amount by Product › Category". */
export function describeRequirementQuery(project: KimballProject, query: RequirementQuery): string {
  const process = processById(project, query.processId);
  const measure = process?.facts.find((f) => f.id === query.measureId);
  const what =
    query.aggregate === 'count' || !measure
      ? 'number of rows'
      : `${AGGREGATES.find((a) => a.value === query.aggregate)!.label.toLowerCase()} of ${displayName(measure)}`;
  const column = (q: QueryColumn) => {
    const dim = dimensionById(project, q.dimensionId);
    const subject = q.role?.trim() || (dim ? displayName(dim) : q.dimensionId);
    if (!q.attributeId && !q.column) return subject;
    const attr = dim?.attributes.find((a) => a.id === q.attributeId);
    return `${subject} › ${attr ? displayName(attr) : (q.column ?? q.attributeId ?? '').replace(/_/g, ' ')}`;
  };
  const by = query.groupBy.length ? ` by ${query.groupBy.map(column).join(' and ')}` : '';
  const where = query.filter ? `, where ${column(query.filter.column)} is “${query.filter.value}”` : '';
  return `${process ? displayName(process) : 'Missing process'}: ${what}${by}${where}`;
}

export type AnswerStatus = 'answered' | 'outdated' | 'unanswered';

export interface RequirementAnswer {
  requirement: Requirement;
  /** R1, R2 … as in the requirements document. */
  label: string;
  status: AnswerStatus;
  /** The saved query for the explorer, when it still matches the design. */
  query: ExploreQuery | null;
  /** The saved query in words; null when there is none. */
  description: string | null;
}

/** How each requirement is answered by the prototype, in document order. */
export function requirementAnswers(project: KimballProject, model: PhysicalModel = physicalModel(project)): RequirementAnswer[] {
  return project.requirements.map((requirement, i) => {
    const saved = requirement.query;
    const query = saved ? fromRequirementQuery(model, saved) : null;
    return {
      requirement,
      label: `R${i + 1}`,
      status: !saved ? 'unanswered' : query ? 'answered' : 'outdated',
      query,
      description: saved ? describeRequirementQuery(project, saved) : null,
    };
  });
}
