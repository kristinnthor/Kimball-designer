import type { PhaseId, StakeholderType } from './model';

/**
 * Coaching content per phase. Single source for the UI coach panel and the
 * `kimball guide` CLI command the skill uses.
 */
export interface PhaseGuidance {
  /** Why the phase matters, in two or three sentences. */
  why: string;
  /** Questions to ask stakeholders (or yourself) in this phase. */
  ask: string[];
  /** Practical tips. */
  tips: string[];
  /** Common mistakes to avoid. */
  pitfalls: string[];
  /** Short worked examples. */
  examples: string[];
}

export const GUIDANCE: Record<PhaseId, PhaseGuidance> = {
  kickoff: {
    why: 'A dimensional model is only as useful as the business problem it serves. Agreeing on purpose, sponsor and scope up front keeps the interviews focused and stops the model from growing in every direction.',
    ask: [
      'What business decisions should this warehouse improve?',
      'Who is the sponsor, and how will they judge success in six months?',
      'Which business areas are in scope for the first release — and which are explicitly not?',
      'Are there deadlines, regulatory drivers or known pain points?',
    ],
    tips: [
      'Write the purpose as a business outcome ("reduce out-of-stocks"), not a technology ("build a lakehouse").',
      'Keep success criteria measurable and few — two or three is plenty.',
      'Recording what is out of scope is as valuable as what is in scope.',
    ],
    pitfalls: [
      'Starting from the source systems instead of the business questions.',
      'A scope so broad that every department expects something in release one.',
    ],
    examples: ['Purpose: "Give merchandising one trusted view of sales and margin by category, store and week."'],
  },
  stakeholders: {
    why: 'Kimball requirements come from interviews with the people who make decisions and the people who know the data. A balanced list — executives, managers, analysts and source-system owners — prevents both wishful thinking and technical tunnel vision.',
    ask: [
      'Who makes decisions that this data should support?',
      'Who builds reports and analyses today, and where does it hurt?',
      'Who owns and understands each source system?',
      'Whose sign-off will the model need?',
    ],
    tips: [
      'Interview in small groups by role; one facilitator, one note-taker.',
      'Send a short agenda in advance; ask about decisions and measures, not about tables.',
      'Mark interviews done as you go — the notes are the raw material for requirements.',
    ],
    pitfalls: [
      'Only talking to IT, or only talking to executives.',
      'Asking "what data do you want?" — you will get a list of every field in the source system.',
    ],
    examples: ['VP Merchandising (executive), Category manager (business), BI analyst (analyst), POS platform lead (IT).'],
  },
  requirements: {
    why: 'Requirements are the business questions people need answered and the measures they use to judge performance. They are what you will trace every business process and fact back to.',
    ask: [
      'What are the top questions you cannot answer today?',
      'How do you measure success in your area? Which KPIs do you report?',
      'How do you want to slice those numbers — by what, and at what level of detail?',
      'What would you do differently if you had this information?',
    ],
    tips: [
      'Record requirements in the stakeholder\'s own words; one question per requirement.',
      'Capture KPIs separately — they often reveal the facts you will need.',
      'Use MoSCoW priority so the first release is small and valuable.',
      'Write down assumptions and open questions instead of guessing.',
    ],
    pitfalls: [
      'Writing report specifications ("a monthly PDF with 12 columns") instead of questions.',
      'Silently filling gaps — anything uncertain belongs in open questions.',
    ],
    examples: [
      '"Did a promotion increase sales, and did it cannibalise other products?" — KPIs: promotion lift, incremental margin.',
    ],
  },
  processes: {
    why: 'Step 1 of the four-step design: select the business process. A business process is an operational event that produces measurements — taking an order, shipping, paying a claim. Each one becomes (at least) one fact table and one row of the bus matrix.',
    ask: [
      'Which business events produce the numbers behind each requirement?',
      'Which source system captures that event, and who owns it?',
      'Is the data available at the most detailed level?',
      'How valuable is this process to the business, and how feasible is it to deliver?',
    ],
    tips: [
      'Name processes as events or activities ("Retail sales", "Claims submitted"), not departments or reports.',
      'Link each requirement to the processes that answer it — unlinked requirements expose missing processes.',
      'Score business value and feasibility 1–5; build the high-high processes first.',
    ],
    pitfalls: [
      'Modelling a department ("Marketing") instead of its processes ("Campaign responses", "Email sends").',
      'Merging two events with different grains into one process.',
    ],
    examples: ['Retail: Retail sales · Store inventory · Purchase order receipts · Online order fulfilment.'],
  },
  grain: {
    why: 'Step 2: declare the grain — exactly what one row in the fact table represents. It is the most important design decision. Declare it in business terms before choosing dimensions or facts, and prefer the most atomic grain the source can provide.',
    ask: [
      'What is the most detailed level at which this event is captured?',
      'What exactly is one row? An order, an order line, a daily balance?',
      'Does each row represent an event (transaction), a period (snapshot) or the lifetime of something (accumulating snapshot)?',
    ],
    tips: [
      'Use the form "One row per …".',
      'Atomic grain answers questions nobody has asked yet; summaries can always be built from it.',
      'If two measures have different grains, they belong in different fact tables.',
    ],
    pitfalls: [
      'Choosing a summarised grain to "save space" and losing the ability to drill down.',
      'Mixing grains in one fact table (for example order headers and order lines).',
    ],
    examples: [
      'Transaction: "One row per product scanned on a sales transaction line."',
      'Periodic snapshot: "One row per product per store per day."',
      'Accumulating snapshot: "One row per order line, updated at each fulfilment milestone."',
    ],
  },
  dimensions: {
    why: 'Step 3: identify the dimensions — the who, what, where, when, why and how that describe each row at the declared grain. Dimensions that mean the same thing across processes must be conformed (shared), because that is what lets you compare and drill across processes.',
    ask: [
      'At this grain, who is involved? What is being measured? Where? When? Why? How?',
      'Which attributes do people filter, group and label reports by?',
      'Is this the same Customer (Product, Store, …) as in the other processes?',
      'Does a date play several roles (order date, ship date)?',
    ],
    tips: [
      'Reuse a dimension across processes whenever it means the same thing — that is a conformed dimension.',
      'Use roles for role-playing dimensions instead of creating "Order date" and "Ship date" dimensions.',
      'Transaction numbers with no attributes are degenerate dimensions.',
      'Note which attributes need history (SCD type 2).',
    ],
    pitfalls: [
      'Creating slightly different versions of the same dimension per process.',
      'Putting descriptive text in the fact table instead of a dimension.',
      'Forgetting the date dimension.',
    ],
    examples: ['Retail sales: Date, Product, Store, Promotion, Customer, Employee (as Cashier), Payment method, POS transaction number.'],
  },
  facts: {
    why: 'Step 4: identify the facts — the numeric measurements produced by the event at the declared grain. Knowing whether a fact is additive, semi-additive or non-additive tells report builders how it can be aggregated.',
    ask: [
      'What numbers does this event produce at the declared grain?',
      'Which KPIs from the requirements are built from these numbers?',
      'Can this number be summed across all dimensions? Across time?',
    ],
    tips: [
      'Prefer additive facts; store the additive parts of ratios (numerator and denominator).',
      'Balances and levels are semi-additive — do not sum them over time.',
      'A process with no numeric measures can still be useful as a factless fact table.',
    ],
    pitfalls: [
      'Storing percentages or unit prices and then summing them.',
      'Adding facts that belong to a different grain.',
    ],
    examples: ['Additive: sales amount, quantity. Semi-additive: inventory on hand. Non-additive: unit price, margin %.'],
  },
  bubbles: {
    why: 'The bubble diagram is Kimball\'s high-level model: one per business process, with the process in the centre and its dimensions around it. It is the artefact to review with business stakeholders before any detailed design.',
    ask: [
      'Looking at this diagram, can you answer your questions by combining these dimensions?',
      'Is anything missing that you would want to filter or group by?',
      'Does the grain match how you think about this process?',
    ],
    tips: [
      'Walk stakeholders through one diagram at a time.',
      'Amber bubbles are conformed — point out how they connect processes.',
      'Export SVG or PNG for slides and documents.',
    ],
    pitfalls: ['Reviewing table designs with business users — the bubble diagram is the right level.'],
    examples: [],
  },
  matrix: {
    why: 'The enterprise bus matrix lists business processes as rows and dimensions as columns. It is the architecture plan for an integrated warehouse: conformed columns are built once and reused, and each row can be delivered incrementally.',
    ask: [
      'Which dimensions are shared by most processes? Who owns their definition?',
      'Is there a column used by only one process that should really be shared?',
      'In which order should the rows be delivered?',
    ],
    tips: [
      'Columns used by many rows are your most valuable conformed dimensions — agree their definitions first.',
      'Sort rows by priority to plan iterations.',
      'Keep the matrix on the wall (or in the README) — it is a communication tool.',
    ],
    pitfalls: [
      'Columns that are near-duplicates (Customer vs Client) — conform them.',
      'Treating the matrix as finished; it grows with every new process.',
    ],
    examples: [],
  },
  review: {
    why: 'Before handing over, resolve errors and warnings, check open questions with their owners, and export the deliverables for review with the sponsor.',
    ask: [
      'Are all must-have requirements linked to a modelled process?',
      'Which open questions block the first iteration?',
      'Who signs off the bus matrix and the first bubble diagrams?',
    ],
    tips: [
      'Errors must be fixed; warnings usually should be; notes are judgement calls.',
      'Share requirements.md plus the bubble diagrams with stakeholders.',
      'Ask Claude to render the deliverables and draft the next step (detailed dimension design).',
    ],
    pitfalls: ['Skipping the sponsor review because the diagrams "look right".'],
    examples: [],
  },
  prototype: {
    why: 'A design is easier to judge with rows in it. The prototype turns each dimension and business process into a table, fills them with made-up data and lets you ask the questions from your requirements. You see whether the grain, the dimensions and the facts really answer them before anyone writes a load job, and you get a CREATE TABLE script and index advice to start the build.',
    ask: [
      'Can we answer each must-have requirement with one of these queries?',
      'Which attribute is the business key of each dimension in the source system?',
      'Roughly how many rows will each fact table get per day or month?',
      'Which database platform will the warehouse run on?',
    ],
    tips: [
      "Save the question that answers each requirement. A must-have you can't answer points to a missing dimension, attribute or fact.",
      'Ask Claude to suggest realistic sample values for the attributes, so the data looks like your business.',
      'Group a semi-additive fact (a balance) by date, or average it; the explorer warns when a sum would be wrong.',
      'Download the sandbox bundle and run docker compose up -d to query the same tables with any SQL tool.',
      'Building with dbt? The dbt project has a model per table, the tests and the sample rows as seeds. With PostgreSQL, dbt seed, dbt run and dbt test work against the sandbox as they are.',
      'Treat the script as a starting point: review data types, text lengths and business keys before you build.',
    ],
    pitfalls: [
      'Mistaking sample data for real data: the rows are random, only the structure is yours.',
      'Adding indexes everywhere: fact tables need few (or a columnstore); dimensions need their keys.',
      'Building every table at once instead of the top process on the prioritisation grid first.',
    ],
    examples: ['"Net sales amount by product category and month" for a retail sales fact table.'],
  },
};

/** Interview questions by stakeholder type, used in the Stakeholders phase and the skill's interview guide. */
export const INTERVIEW_QUESTIONS: Record<StakeholderType, string[]> = {
  executive: [
    'What are the organisation\'s objectives for the next year? How is success measured?',
    'Which decisions would you make differently with better information?',
    'What are the biggest risks or problems in your area right now?',
    'How do you compare performance today — over time, against plan, against competitors?',
    'What would make this program a success in your eyes?',
  ],
  business: [
    'Describe your team\'s responsibilities. What events or activities do you manage?',
    'Which reports do you use today? What do you do with them? What is missing?',
    'How do you measure your team\'s performance? Which KPIs?',
    'How do you need to slice those numbers — by product, customer, region, time…?',
    'How far back do you need history, and how current must the data be?',
  ],
  analyst: [
    'Which analyses do you run most often, and how long do they take?',
    'Where does the data come from today, and how much manual work is involved?',
    'Which numbers are disputed or reconciled by hand?',
    'Which questions are you asked that you cannot answer?',
    'Which definitions differ between departments (customer, revenue, active)?',
  ],
  it: [
    'Which systems capture these business events? At what level of detail?',
    'How reliable is the data? Known quality issues, late or missing records?',
    'How are changes captured — updates in place, history tables, change logs?',
    'Which identifiers link systems together (customer id, product code)?',
    'Are there constraints on access, volume, privacy or load windows?',
  ],
  other: [
    'How do you use information from this area today?',
    'What questions would you like answered?',
    'Who else should we talk to?',
  ],
};
