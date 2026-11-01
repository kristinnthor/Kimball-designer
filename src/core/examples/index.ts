import type { KimballProject } from '../model';
import { normalizeProject } from '../normalize';
import retail from './retail.kimball.json';
import saas from './saas.kimball.json';
import healthcare from './healthcare.kimball.json';

export interface ExampleInfo {
  id: 'retail' | 'saas' | 'healthcare';
  title: string;
  description: string;
}

export const EXAMPLES: ExampleInfo[] = [
  { id: 'retail', title: 'Retail sales & inventory', description: 'Store sales, daily inventory, vendor receipts and online fulfilment.' },
  { id: 'saas', title: 'SaaS subscriptions', description: 'Subscription changes, MRR snapshots, invoicing, product usage and support.' },
  { id: 'healthcare', title: 'Healthcare claims', description: 'Medical and pharmacy claims, member eligibility and prior authorisations.' },
];

const DATA: Record<ExampleInfo['id'], unknown> = { retail, saas, healthcare };

export function isExampleId(id: string): id is ExampleInfo['id'] {
  return id in DATA;
}

/** A fresh, normalised copy of an example project. */
export function loadExample(id: ExampleInfo['id'], now?: string): KimballProject {
  const project = normalizeProject(JSON.parse(JSON.stringify(DATA[id])), now);
  return now ? { ...project, meta: { ...project.meta, createdAt: now, updatedAt: now } } : project;
}
