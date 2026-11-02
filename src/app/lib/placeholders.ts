/**
 * Example text for empty fields. Each list is cycled by the item's position, so
 * the second requirement or fact suggests something different from the first,
 * and lists for facts, attributes and hierarchies follow the process or dimension name.
 */

export const pick = <T,>(list: readonly T[], index: number): T => list[((index % list.length) + list.length) % list.length]!;

export const REQUIREMENT_EXAMPLES: { statement: string; kpi: string }[] = [
  { statement: 'e.g. Where and when are we out of stock?', kpi: 'e.g. Out-of-stock rate' },
  { statement: 'e.g. Which promotions actually increased margin?', kpi: 'e.g. Promotion margin uplift' },
  { statement: 'e.g. How do sales this year compare with last year by store and week?', kpi: 'e.g. Sales vs last year %' },
  { statement: 'e.g. Which customers are likely to stop buying from us?', kpi: 'e.g. Churn rate' },
  { statement: 'e.g. Are orders delivered on the date we promised?', kpi: 'e.g. On-time delivery %' },
  { statement: 'e.g. Which products are returned most, and why?', kpi: 'e.g. Return rate' },
];

export const ASSUMPTION_EXAMPLES = [
  'e.g. The fiscal calendar is 4-4-5',
  'e.g. Returns are recorded against the original order',
  'e.g. All amounts are reported in one currency',
  'e.g. The ERP is the master for product data',
  'e.g. One customer can hold several accounts',
];

export const QUESTION_EXAMPLES = [
  'e.g. Who owns returns data?',
  'e.g. Is cost available per order line or only per order?',
  'e.g. How many years of history does the POS keep?',
  'e.g. Which currency should reports use?',
  'e.g. Are cancelled orders kept in the source system?',
];

export const PROCESS_DESCRIPTION_EXAMPLES = [
  'What happens in this event? e.g. A customer buys products at a till.',
  'What happens in this event? e.g. A warehouse ships an order to a customer.',
  'What happens in this event? e.g. Stock is counted in every store each night.',
  'What happens in this event? e.g. A customer pays an invoice.',
];

export const SOURCE_EXAMPLES = ['e.g. POS, ERP', 'e.g. WMS', 'e.g. Billing system', 'e.g. CRM', 'e.g. Web analytics'];

const ROLE_BY_TYPE: Record<string, string[]> = {
  executive: ['e.g. Chief financial officer', 'e.g. VP of sales', 'e.g. Chief operating officer'],
  business: ['e.g. Head of merchandising', 'e.g. Store operations manager', 'e.g. Customer service lead'],
  analyst: ['e.g. BI analyst', 'e.g. Finance analyst', 'e.g. Marketing analyst'],
  it: ['e.g. ERP administrator', 'e.g. POS system owner', 'e.g. Data engineer'],
  other: ['e.g. Data protection officer', 'e.g. External consultant'],
};

const DEPARTMENT_BY_TYPE: Record<string, string[]> = {
  executive: ['e.g. Finance', 'e.g. Sales', 'e.g. Operations'],
  business: ['e.g. Merchandising', 'e.g. Store operations', 'e.g. Customer service'],
  analyst: ['e.g. BI team', 'e.g. Finance', 'e.g. Marketing'],
  it: ['e.g. IT', 'e.g. Enterprise applications', 'e.g. Data platform'],
  other: ['e.g. Legal', 'e.g. External'],
};

export const stakeholderRole = (type: string, index: number) => pick(ROLE_BY_TYPE[type] ?? ROLE_BY_TYPE.other!, index);
export const stakeholderDepartment = (type: string, index: number) =>
  pick(DEPARTMENT_BY_TYPE[type] ?? DEPARTMENT_BY_TYPE.other!, index);

/** Lists keyed by words that commonly appear in names; the first match wins. */
type Themed = { match: RegExp; items: string[] }[];

function themed(table: Themed, name: string, fallback: string[], index: number): string {
  const hit = table.find((t) => t.match.test(name));
  return pick(hit?.items ?? fallback, index);
}

const FACTS: Themed = [
  { match: /inventor|stock|on hand/i, items: ['Quantity on hand', 'Stock value', 'Days of supply', 'Quantity on order'] },
  { match: /ship|deliver|fulfil/i, items: ['Quantity shipped', 'Shipping cost', 'Days to deliver', 'Weight'] },
  { match: /pay|invoice|bill|receivable/i, items: ['Invoice amount', 'Amount paid', 'Discount taken', 'Days to pay'] },
  { match: /return|refund/i, items: ['Quantity returned', 'Refund amount', 'Restocking fee'] },
  { match: /web|session|click|visit|page/i, items: ['Page views', 'Session duration', 'Bounce flag count'] },
  { match: /ticket|support|case|call/i, items: ['Handle time', 'Wait time', 'Reopen count'] },
  { match: /claim/i, items: ['Claim amount', 'Paid amount', 'Days to settle'] },
  { match: /subscri|mrr|revenue|plan/i, items: ['MRR change', 'Seats', 'Discount amount'] },
  { match: /balance|account|snapshot/i, items: ['Balance', 'Credit limit', 'Interest accrued'] },
];
const FACT_FALLBACK = ['Sales amount', 'Quantity sold', 'Discount amount', 'Cost amount', 'Tax amount'];

const UNIT_HINTS: [RegExp, string][] = [
  [/amount|cost|value|price|fee|balance|mrr|revenue|limit|interest|discount/i, 'currency'],
  [/days|time|duration/i, 'minutes or days'],
  [/weight/i, 'kg'],
  [/quantity|count|views|seats|units/i, 'units'],
];

export function factPlaceholder(processName: string, index: number): { name: string; unit: string } {
  const name = themed(FACTS, processName, FACT_FALLBACK, index);
  const unit = UNIT_HINTS.find(([re]) => re.test(name))?.[1] ?? 'units';
  return { name: `e.g. ${name}`, unit: `e.g. ${unit}` };
}

const ATTRIBUTES: Themed = [
  { match: /date|time|calendar|day|period|month/i, items: ['Calendar date', 'Month name', 'Quarter', 'Year', 'Fiscal week', 'Holiday flag'] },
  { match: /customer|client|member|patient|subscriber/i, items: ['Customer name', 'Segment', 'City', 'Country', 'Signup date'] },
  { match: /product|item|sku|article/i, items: ['Product name', 'Brand', 'Category', 'Size', 'Colour'] },
  { match: /store|location|branch|site|warehouse|region/i, items: ['Store name', 'City', 'Region', 'Store format', 'Opening date'] },
  { match: /employee|staff|agent|rep|provider|doctor/i, items: ['Employee name', 'Job title', 'Department', 'Hire date'] },
  { match: /supplier|vendor/i, items: ['Supplier name', 'Country', 'Payment terms'] },
  { match: /promotion|campaign|offer/i, items: ['Promotion name', 'Promotion type', 'Discount %', 'Start date'] },
  { match: /channel/i, items: ['Channel name', 'Channel group'] },
  { match: /account/i, items: ['Account number', 'Account type', 'Opened date', 'Status'] },
];
const ATTRIBUTE_FALLBACK = ['Name', 'Type', 'Category', 'Status', 'Code'];

export const attributePlaceholder = (dimensionName: string, index: number) =>
  `e.g. ${themed(ATTRIBUTES, dimensionName, ATTRIBUTE_FALLBACK, index)}`;

const HIERARCHIES: Themed = [
  { match: /date|time|calendar|day|period|month/i, items: ['Day → Month → Quarter → Year', 'Day → Fiscal week → Fiscal period → Fiscal year'] },
  { match: /product|item|sku|article/i, items: ['Product → Brand → Category', 'Product → Subcategory → Department'] },
  { match: /store|location|branch|site|warehouse|region/i, items: ['Store → City → Region → Country', 'Store → District → Division'] },
  { match: /customer|client|member|patient|subscriber/i, items: ['Customer → City → Country', 'Customer → Segment'] },
  { match: /employee|staff|agent|rep/i, items: ['Employee → Team → Department'] },
];

export const hierarchyPlaceholder = (dimensionName: string) =>
  `e.g. ${themed(HIERARCHIES, dimensionName, ['Item → Group → Category'], 0)}`;

const DATE_ROLES = ['e.g. Order date', 'e.g. Ship date', 'e.g. Delivery date', 'e.g. Due date'];
const OTHER_ROLES = ['e.g. Bill-to', 'e.g. Ship-to', 'e.g. Sold-to'];

export const rolePlaceholder = (isDate: boolean, index: number) => pick(isDate ? DATE_ROLES : OTHER_ROLES, index);

export const DIMENSION_DESCRIPTION_EXAMPLES = [
  'Who buys, e.g. one row per customer',
  'What is sold, e.g. one row per product',
  'Where it happens, e.g. one row per store',
];
