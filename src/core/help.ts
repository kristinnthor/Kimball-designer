import type { ExampleInfo } from './examples';
import {
  ADDITIVITY,
  DIMENSION_KINDS,
  FACT_TABLE_TYPES,
  SCD_TYPES,
  type KimballProject,
  type PhaseId,
} from './model';
import { phaseDef } from './phases';
import { RULES } from './validate';

/**
 * Help content. Single source for the in-app Help page, `docs/USER-GUIDE.md`
 * and the skill's `references/user-guide.md` (see `helpToMarkdown`).
 *
 * Text fields use a small inline markup that both Markdown and the UI render:
 * **bold**, *italic*, `code` and [label](https://…).
 */

export const HOSTED_URL = 'https://kimball.kristinn.eu';
export const REPO_URL = 'https://github.com/kristinnthor/Kimball-designer';

export interface HelpSection {
  id: string;
  title: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'deliverables', title: 'What you get' },
  { id: 'phases', title: 'The eleven phases' },
  { id: 'demos', title: 'Demos' },
  { id: 'ways', title: 'Ways to use it' },
  { id: 'saving', title: 'Saving and privacy' },
  { id: 'glossary', title: 'Glossary' },
  { id: 'rules', title: 'Validation rules' },
  { id: 'shortcuts', title: 'Keyboard shortcuts' },
  { id: 'faq', title: 'FAQ' },
];

// ─── Overview ───

export const HELP_OVERVIEW = {
  intro: [
    'Kimball Designer guides you through the **business-requirements stage of the Kimball method**: the short, disciplined process that comes before anyone designs a table. You interview the business, find the business processes that produce the numbers, declare their grain, and agree which dimensions they share.',
    'It works in your browser, inside Claude as a skill, or both at once, and ends with the two pictures every Kimball project needs: a **bubble diagram** per business process and the **enterprise bus matrix**. A last, optional step turns the design into tables with sample data to explore, a CREATE TABLE script with index advice, and a Docker sandbox.',
  ],
  audience: [
    '**Data and BI engineers** starting a new warehouse, lakehouse or data mart.',
    '**Analytics engineers** who want a model the business has agreed to before writing dbt models.',
    '**Data architects** planning conformed dimensions across teams.',
    '**Business analysts and product owners** running requirements workshops.',
  ],
  howItFlows:
    'The work is split into eleven short phases in four stages. **Discover** captures the business context, **Model** applies Kimball’s four-step design (process, grain, dimensions, facts), **Deliver** turns it into diagrams, a matrix and documents, and **Build** lets you try the design on sample data and get the SQL to build it. The coach panel explains each phase as you go, and the stepper shows how far you are.',
};

// ─── What you get ───

export const HELP_DELIVERABLES_LEAD =
  'After the first ten phases you have an agreed, documented high-level dimensional design: the blueprint the Kimball method asks for before anyone builds a table. The Prototype phase then gives you a first physical version of it to try out.';

export interface HelpOutcome {
  title: string;
  text: string;
}

/** What the process gives the people who run it, beyond the files. */
export const HELP_OUTCOMES: HelpOutcome[] = [
  {
    title: 'A shared language',
    text: 'Business and IT agree on the names of the business processes, what one row means, and which dimensions describe them. Most warehouse rework comes from getting these wrong.',
  },
  {
    title: 'A scoped, prioritised first release',
    text: 'Each process is scored on business value and feasibility, so the first thing you build is the one that pays off soonest, not the loudest request.',
  },
  {
    title: 'An architecture that grows without rework',
    text: 'The bus matrix shows which dimensions are shared. Build each conformed dimension once and every new process plugs into it, so reports can drill across processes.',
  },
  {
    title: 'Traceability',
    text: 'Every business question is linked to the process that answers it and to the stakeholder who asked. Nothing gets built that nobody needs, and nothing needed is forgotten.',
  },
  {
    title: 'Honest unknowns',
    text: 'Assumptions and open questions are recorded with owners instead of guessed. Kimball Designer, and Claude with the skill, never invent business facts.',
  },
  {
    title: 'A head start on the build',
    text: 'Grain, fact table type, facts with additivity, dimensions with roles and SCD hints are exactly the inputs the detailed design and ETL work start from.',
  },
];

export interface HelpDeliverable {
  id: string;
  title: string;
  /** File names or formats. */
  formats: string;
  /** One sentence: what it is. */
  summary: string;
  /** What is inside. */
  contains: string[];
  /** Who reads it and what they do with it. */
  usedBy: string;
  /** Why it matters. */
  why: string;
  /** Where to find it. */
  where: string;
  /** Screenshot for the Markdown guide (path relative to docs/). */
  image?: { src: string; alt: string };
}

export const HELP_DELIVERABLES: HelpDeliverable[] = [
  {
    id: 'bubbles',
    title: 'Bubble diagrams',
    formats: 'SVG, PNG, Mermaid · `bubbles/<process>.svg`, `.mmd`',
    summary: 'One picture per business process: the process (the future fact table) in the middle, the dimensions that describe it around it, and the grain underneath.',
    contains: [
      'The business process and its fact table type.',
      'Every dimension it uses, with role names (for example *Order date* and *Ship date* for one Date dimension).',
      'Conformed dimensions highlighted in amber, so shared pieces stand out.',
      'The grain statement: what one row represents.',
    ],
    usedBy: 'Business stakeholders, to confirm "yes, this is how we think about orders". Modellers, as the starting point for the detailed design.',
    why: 'It is the simplest model a non-technical person can check. Mistakes caught here cost minutes; caught after the build, they cost weeks.',
    where: 'Phase 8 *Bubble diagrams*, `kimball render`, and inside the requirements document as Mermaid.',
    image: { src: 'images/ui-bubble-diagrams.jpg', alt: 'Bubble diagram for a business process, with conformed dimensions in amber' },
  },
  {
    id: 'matrix',
    title: 'Enterprise bus matrix',
    formats: 'Markdown, CSV, HTML · `bus-matrix.md`, `.csv`, `.html`',
    summary: 'Business processes as rows, dimensions as columns, and a mark wherever a process uses a dimension.',
    contains: [
      'Every business process with its grain.',
      'Every dimension, most-shared first; conformed columns highlighted.',
      'Role names in the cells where a dimension plays several roles.',
      'Optional ordering by priority, so the matrix doubles as a delivery plan.',
    ],
    usedBy: 'Architects and data engineers, to plan which dimensions to build once and share. Programme managers, to plan releases one row at a time.',
    why: 'It is the architecture of the whole warehouse on one page. Columns with many marks are the conformed dimensions that make cross-process reporting possible.',
    where: 'Phase 9 *Bus matrix*, `kimball render`, and section 6 of the requirements document.',
    image: { src: 'images/ui-bus-matrix.jpg', alt: 'Interactive bus matrix with conformed dimension columns' },
  },
  {
    id: 'requirements',
    title: 'Requirements document',
    formats: 'Markdown · `requirements.md`',
    summary: 'The written record of everything agreed, ready for sign-off or a pull request.',
    contains: [
      'Overview: purpose, sponsor, scope in and out, success criteria.',
      'Stakeholders and interview status.',
      'Business requirements with priority, KPIs, who raised them and which processes answer them.',
      'Each business process with grain, fact table type, dimensions, facts and its bubble diagram.',
      'The dimension catalogue with kinds, key attributes, hierarchies and where each is used.',
      'The bus matrix, the prioritisation, assumptions and open questions.',
    ],
    usedBy: 'The sponsor, to sign off. The whole team, as the reference during the build.',
    why: 'Decisions made in workshops fade quickly. A document that traces every requirement to a process keeps the team honest.',
    where: 'Phase 10 *Review & export* and `kimball render`.',
  },
  {
    id: 'priority',
    title: 'Prioritisation grid',
    formats: 'In the UI and the requirements document',
    summary: 'Each business process plotted by business value against feasibility, both scored 1 to 5.',
    contains: ['Four quadrants: *Build first*, *Valuable but hard*, *Easy, lower value* and *Later*.', 'The score (value × feasibility) for each process.'],
    usedBy: 'The sponsor and the delivery lead, to choose the first release.',
    why: 'Kimball recommends delivering one business process at a time. The grid makes that choice explicit and defensible.',
    where: 'Phase 4 *Business processes* and section 7 of the requirements document.',
  },
  {
    id: 'review',
    title: 'Validation report',
    formats: 'In the UI, `kimball validate` (text or `--json`)',
    summary: 'The model checked against 16 Kimball best-practice rules, each with a hint on how to fix it.',
    contains: ['Errors (broken references, missing names), warnings (no grain, no date dimension, unused dimensions) and notes.', 'A link from each finding to the phase where you fix it.'],
    usedBy: 'Whoever runs the process, before sharing anything.',
    why: 'It catches the classic mistakes early: processes without a grain, facts without dimensions, dimensions nobody shares.',
    where: 'Phase 10 *Review & export*, the coach panel checklist, and `kimball validate`.',
  },
  {
    id: 'questions',
    title: 'Assumptions and open questions',
    formats: 'In the UI and the requirements document',
    summary: 'What you assumed and what you still need to find out, each question with an owner.',
    contains: ['Assumptions such as "the fiscal calendar is 4-4-5".', 'Open and answered questions with owners.'],
    usedBy: 'The team, as a to-do list before the detailed design.',
    why: 'Unknowns written down get answered. Unknowns left in someone’s head become wrong assumptions in production.',
    where: 'Phase 3 *Requirements* and the requirements document.',
  },
  {
    id: 'project',
    title: 'Project file',
    formats: 'JSON · `<project>.kimball.json`',
    summary: 'The single source of truth behind every deliverable above, described by a JSON Schema.',
    contains: ['Everything you entered: scope, stakeholders, requirements, processes, dimensions, facts, assumptions and questions.'],
    usedBy: 'You, to save and share work. Git, to version it. Claude and the `kimball` CLI, to read and update it.',
    why: 'Diagrams and matrices are always regenerated from this file, so they can never disagree with each other.',
    where: 'Project menu → *Export project file*, or the file `kimball serve` keeps in sync.',
  },
  {
    id: 'prototype',
    title: 'Prototype: sample data, SQL and a sandbox',
    formats: 'In the UI · `schema.sql`, `index-recommendations.md`, `docker-compose.yml`, CSV · `kimball prototype`, `kimball ddl`',
    summary: 'Your design as a star schema filled with made-up rows, a CREATE TABLE script with index advice, and a PostgreSQL sandbox for Docker.',
    contains: [
      'One table per dimension (surrogate key, business key, type 2 history columns) and one per business process (a key per dimension role, the facts).',
      'Sample rows you can group and filter in the browser, with the matching SQL.',
      'CREATE TABLE scripts for PostgreSQL, SQL Server or Snowflake, with keys and indexes, and recommendations for later (columnstore, BRIN, partitioning, clustering).',
      'A Docker Compose sandbox that loads the tables and data on first start.',
    ],
    usedBy: 'Data engineers starting the build, and the business users who want to see how their questions will be answered.',
    why: 'Problems with the grain or missing dimensions show up in minutes with rows in front of you, instead of after the first load job.',
    where: 'Phase 11 *Prototype*, or `kimball prototype` and `kimball ddl` from the CLI. Claude can suggest realistic sample values for your attributes.',
    image: { src: 'images/ui-prototype.jpg', alt: 'The Prototype phase: net sales grouped by product category over sample data, with the SQL' },
  },
  {
    id: 'handoff',
    title: 'Claude hand-off summary',
    formats: 'Plain text',
    summary: 'A compact progress summary you can paste into Claude to continue the work there.',
    contains: ['Progress per phase, open findings and what to do next.'],
    usedBy: 'Anyone moving between the browser and Claude.',
    why: 'Claude picks up exactly where you left off, without re-explaining the project.',
    where: 'Phase 10 *Review & export* → *Copy summary*, or `kimball summary`.',
  },
];

/** What naturally follows the process. */
export const HELP_NEXT_STEPS: string[] = [
  'Build the conformed dimensions first: the columns with the most marks in the bus matrix.',
  'Pick the top process on the prioritisation grid and do its detailed design: every attribute, slowly changing dimension strategy and source-to-target mapping.',
  'Try it in phase 11 *Prototype* first: query the sample data, check each must-have requirement can be answered, and start from the generated CREATE TABLE script.',
  'Build and release that one process end to end, then the next row of the matrix.',
  'Keep the project file in your repository and update it when scope changes, so the diagrams stay current.',
];

export const HELP_NOT_INCLUDED_LEAD = 'Kimball Designer covers the high-level design and a first physical prototype. It does not produce:';

/** Honest scope: what the tool does not produce. */
export const HELP_NOT_INCLUDED: string[] = [
  'A finished physical design: the CREATE TABLE script is a starting point to review, not production-ready DDL.',
  'Source-to-target mappings and ETL or ELT code.',
  'Data profiling or connections to your source systems.',
  'Dashboards or reports.',
];

// ─── The eleven phases ───

export interface HelpPhase {
  youDo: string;
  youRecord: string;
  doneWhen: string;
}

export const HELP_PHASES: Record<PhaseId, HelpPhase> = {
  kickoff: {
    youDo: 'Agree with the sponsor why the warehouse exists and what is in scope.',
    youRecord: 'Name, purpose, sponsor, scope in and out, success criteria.',
    doneWhen: 'Name, purpose and scope are filled in.',
  },
  stakeholders: {
    youDo: 'List who to interview (executives, managers, analysts, source owners) and hold the interviews.',
    youRecord: 'People, roles, interview status and notes.',
    doneWhen: 'Every interview is done or skipped, and at least one is done.',
  },
  requirements: {
    youDo: 'Turn interview notes into business questions and KPIs.',
    youRecord: 'Requirements with priority and KPIs, assumptions and open questions.',
    doneWhen: 'At least one requirement is recorded.',
  },
  processes: {
    youDo: 'Find the business events that produce the numbers, and score them.',
    youRecord: 'Business processes, owners, source systems, value and feasibility, linked requirements.',
    doneWhen: 'At least one business process exists.',
  },
  grain: {
    youDo: 'Declare exactly what one fact row represents, and the fact table type.',
    youRecord: 'A grain statement ("One row per …") and a type per process.',
    doneWhen: 'Every process has a grain and a fact table type.',
  },
  dimensions: {
    youDo: 'Ask who, what, where, when, why and how about one row, and reuse dimensions across processes.',
    youRecord: 'The dimension catalogue, attributes, hierarchies, roles and which process uses what.',
    doneWhen: 'Every process has at least one dimension.',
  },
  facts: {
    youDo: 'List the numeric measurements captured at the grain.',
    youRecord: 'Facts with additivity, unit and description, or *factless*.',
    doneWhen: 'Every process has facts or is marked factless.',
  },
  bubbles: {
    youDo: 'Review each process as a bubble diagram with its stakeholders.',
    youRecord: 'Nothing new: diagrams are drawn from your model. Click a bubble to edit it.',
    doneWhen: 'Every process has a diagram (at least one dimension).',
  },
  matrix: {
    youDo: 'Check the processes against the shared dimensions and fill gaps.',
    youRecord: 'Usage marks, toggled directly in the grid.',
    doneWhen: 'Every dimension is used by a process.',
  },
  review: {
    youDo: 'Resolve the findings and export the deliverables.',
    youRecord: 'Fixes; then download the files or hand off to Claude.',
    doneWhen: 'There are no errors or warnings.',
  },
  prototype: {
    youDo: 'Explore the design as tables filled with sample data, then download the CREATE TABLE script, index advice and a Docker sandbox.',
    youRecord: 'Optional: the SQL dialect, sample row counts and dates, and per attribute a data type, business key and sample values.',
    doneWhen: 'Every process has a grain, dimensions and facts, so it can be built as a table.',
  },
};

// ─── Demos ───

export type DemoSetup =
  | { kind: 'example'; example: ExampleInfo['id'] }
  | { kind: 'blank'; name: string }
  /** Keep the open project; load the example only when none is open. */
  | { kind: 'current-or-example'; example: ExampleInfo['id'] }
  /** Read-only instructions; nothing to set up. */
  | { kind: 'none' };

export interface DemoStep {
  title: string;
  body: string;
  /** Phase to show for this step. */
  phase?: PhaseId;
  /** Commands to copy (shown as a code block). */
  code?: string;
  /** True once the user has done what the step asks. */
  done?: (project: KimballProject) => boolean;
}

export interface HelpDemo {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  setup: DemoSetup;
  steps: DemoStep[];
  image?: { src: string; alt: string };
}

const salesProcess = (p: KimballProject) => p.processes.find((x) => /sale/i.test(x.name)) ?? p.processes[0];

export const HELP_DEMOS: HelpDemo[] = [
  {
    id: 'tour',
    title: 'Tour a finished model',
    minutes: 3,
    summary: 'Walk through a complete retail project, from its purpose to the bus matrix, and see what every phase produces.',
    setup: { kind: 'example', example: 'retail' },
    steps: [
      {
        title: 'Start with why',
        phase: 'kickoff',
        body: 'Every project starts with a purpose and a scope agreed with the sponsor. This one gives merchandising and store operations one trusted view of sales, inventory, deliveries and online orders.',
      },
      {
        title: 'Who was interviewed',
        phase: 'stakeholders',
        body: 'Five people: an executive, two business managers, a BI analyst and the owner of the source systems. A balanced list stops both wishful thinking and technical tunnel vision.',
      },
      {
        title: 'What they need to know',
        phase: 'requirements',
        body: 'Their answers became six business questions with KPIs and priorities. Each one is linked to the business process that will answer it.',
      },
      {
        title: 'The business processes',
        phase: 'processes',
        body: 'Four business events produce the numbers. Scroll to the prioritisation grid: *Retail sales* scores highest on value and feasibility, so it is built first.',
      },
      {
        title: 'One row means…',
        phase: 'grain',
        body: 'Each process declares its grain and fact table type. Sales is a *transaction* table, inventory a *periodic snapshot* and online fulfilment an *accumulating snapshot*.',
      },
      {
        title: 'Dimensions, shared',
        phase: 'dimensions',
        body: 'Eleven dimensions describe the processes. Amber ones, like Date, Product and Store, are **conformed**: several processes share them.',
      },
      {
        title: 'The bubble diagrams',
        phase: 'bubbles',
        body: 'Each process as a picture business people can check. Switch between processes with the thumbnails, and click a bubble to edit that dimension.',
      },
      {
        title: 'The bus matrix',
        phase: 'matrix',
        body: 'The whole architecture on one page: processes against dimensions. Try *Priority* row order to read it as a delivery plan.',
      },
      {
        title: 'Review and export',
        phase: 'review',
        body: 'No errors or warnings; the few notes are judgement calls, like a dimension only one process uses. **Download all (.zip)** gives you the requirements document, the matrix and every diagram.',
      },
    ],
  },
  {
    id: 'first-process',
    title: 'Model your first business process',
    minutes: 10,
    summary: 'Start from a blank project and model sales for a small coffee chain. Each step checks itself off when you have done it.',
    setup: { kind: 'blank', name: 'Coffee shop analytics' },
    image: { src: 'images/ui-demo.jpg', alt: 'The demo bar guiding the user through the Grain phase' },
    steps: [
      {
        title: 'Purpose and scope',
        phase: 'kickoff',
        body: 'Fill in **Purpose**, for example *Know which products sell best in each shop, by hour*, and **In scope**: *Till sales in all shops*.',
        done: (p) => p.meta.purpose.trim() !== '' && p.meta.scopeIn.trim() !== '',
      },
      {
        title: 'Interview someone',
        phase: 'stakeholders',
        body: 'Click **Add stakeholder**. Name *Ana*, role *Operations manager*. Set **Interview status** to *Done* and jot down a note.',
        done: (p) => p.stakeholders.some((s) => s.interviewStatus === 'done'),
      },
      {
        title: 'Write a business question',
        phase: 'requirements',
        body: 'Click **Add requirement** and write *Which products sell best in each shop and hour?* Add the KPI *Units sold*.',
        done: (p) => p.requirements.some((r) => r.statement.trim() !== ''),
      },
      {
        title: 'Add the business process',
        phase: 'processes',
        body: 'Under **Quick add**, click **Sales**. Score **Business value** 5 and **Feasibility** 4, and tick your question under **Answers requirements**.',
        done: (p) => {
          const s = salesProcess(p);
          return !!s && s.businessValue != null && s.feasibility != null;
        },
      },
      {
        title: 'Declare the grain',
        phase: 'grain',
        body: 'Choose **Transaction** and write the grain *One row per item on a receipt*. Grain first, always: it decides everything that follows.',
        done: (p) => {
          const s = salesProcess(p);
          return !!s && s.grain.trim() !== '' && s.factTableType != null;
        },
      },
      {
        title: 'Pick the dimensions',
        phase: 'dimensions',
        body: 'Quick-add **Date**, **Product** and **Location** (rename it *Shop* if you like). Then tick all three on the Sales card under **Dimensions per business process**.',
        done: (p) => (salesProcess(p)?.dimensions.length ?? 0) >= 3,
      },
      {
        title: 'Add the facts',
        phase: 'facts',
        body: 'Click **Add fact** twice: *Quantity* and *Sales amount* (unit *currency*). Both are **Additive**: they can be summed across every dimension.',
        done: (p) => (salesProcess(p)?.facts.length ?? 0) >= 2,
      },
      {
        title: 'See your bubble diagram',
        phase: 'bubbles',
        body: 'There it is: Sales in the middle, the dimensions around it and the grain underneath. Download it as SVG or PNG to share.',
        done: (p) => (salesProcess(p)?.dimensions.length ?? 0) > 0,
      },
      {
        title: 'Share a dimension',
        phase: 'processes',
        body: 'Quick-add a second process, **Inventory snapshot**. Then, in **Dimensions**, tick Date, Product and Shop for it too. Those dimensions are now **conformed**.',
        done: (p) => p.processes.length >= 2 && p.processes.every((x) => x.dimensions.length > 0),
      },
      {
        title: 'Read the bus matrix',
        phase: 'matrix',
        body: 'Two rows now share the amber columns. That is the bus architecture: build each conformed dimension once, and every process can use it.',
      },
      {
        title: 'Review and export',
        phase: 'review',
        body: 'The review lists what is still missing, such as the grain and facts for Inventory. Fix what you like, then **Download all (.zip)**. You have just run the whole method in miniature.',
      },
    ],
  },
  {
    id: 'share',
    title: 'Share the results',
    minutes: 2,
    summary: 'Export the diagrams, the matrix and the full deliverables pack. Uses your open project, or the SaaS example if none is open.',
    setup: { kind: 'current-or-example', example: 'saas' },
    steps: [
      {
        title: 'Diagrams as images',
        phase: 'bubbles',
        body: 'Pick a process, then **SVG** for documents, **PNG** for slides or **Copy Mermaid** for wikis and pull requests (GitHub renders Mermaid).',
      },
      {
        title: 'The matrix as a table',
        phase: 'matrix',
        body: 'Download **CSV** for spreadsheets, **HTML** for a styled page, or **Copy Markdown** for a README.',
      },
      {
        title: 'Everything at once',
        phase: 'review',
        body: '**Download all (.zip)** bundles the project file, the requirements document, the matrix in three formats and every bubble diagram.',
      },
      {
        title: 'Keep the source',
        body: 'Use **Project → Export project file** and commit the `.kimball.json` to your repository. Anyone can open it here, or regenerate the files with `kimball render`.',
      },
    ],
  },
  {
    id: 'claude',
    title: 'Work with Claude',
    minutes: 5,
    summary: 'Let Claude interview you while you watch the model grow in the browser. Needs Claude Code and Node 18 or later.',
    setup: { kind: 'none' },
    steps: [
      {
        title: 'Install the skill',
        body: 'In Claude Code, add the marketplace and install the plugin:',
        code: '/plugin marketplace add kristinnthor/Kimball-designer\n/plugin install kimball-designer@kimball-designer',
      },
      {
        title: 'Ask for help',
        body: 'Describe your project in plain words. Claude creates `kimball/project.kimball.json` and offers to open the guided UI on it.',
        code: 'Help me gather requirements for a sales data warehouse and build a bus matrix.',
      },
      {
        title: 'Watch it live',
        body: 'Claude starts `kimball serve`, which opens the guided UI on the same file. Answer Claude in the chat, or type in the browser: each side sees the other’s changes within about two seconds.',
        code: 'node <skill folder>/scripts/kimball.mjs serve kimball/project.kimball.json --open',
      },
      {
        title: 'Get the deliverables',
        body: 'When the model is ready, Claude validates it, writes the files and summarises the bus matrix, the conformed dimensions, what to build first and the blocking questions.',
        code: 'node <skill folder>/scripts/kimball.mjs render kimball/project.kimball.json --out kimball/out',
      },
    ],
  },
];

// ─── Ways to use it ───

export interface HelpWay {
  id: string;
  title: string;
  bestFor: string;
  steps: string[];
  code?: string;
}

export const HELP_WAYS: HelpWay[] = [
  {
    id: 'hosted',
    title: 'In your browser',
    bestFor: 'Trying it out, workshops on a shared screen, people without developer tools.',
    steps: [
      'Open [kimball.kristinn.eu](https://kimball.kristinn.eu) and start a project or an example.',
      'Work through the phases; your project is saved in this browser as you type.',
      'Use **Project → Export project file** to keep a copy or share it.',
    ],
  },
  {
    id: 'offline',
    title: 'Offline, from one file',
    bestFor: 'Locked-down networks and air-gapped machines.',
    steps: [
      'Open `plugin/skills/kimball-designer/ui/index.html` from the repository (or the installed skill) in any modern browser.',
      'It is the same app in a single HTML file, and needs no network at all.',
    ],
  },
  {
    id: 'claude',
    title: 'With Claude (the skill)',
    bestFor: 'Being interviewed phase by phase, turning meeting notes into a model, and writing the deliverables into your repository.',
    steps: [
      'Install the plugin in Claude Code (see the *Work with Claude* demo).',
      'Ask Claude to help gather Kimball requirements. It asks at most three questions at a time and records your answers in the project file.',
      'Claude never invents business facts: anything unknown becomes an open question.',
    ],
    code: '/plugin marketplace add kristinnthor/Kimball-designer\n/plugin install kimball-designer@kimball-designer',
  },
  {
    id: 'sync',
    title: 'Claude and the browser together',
    bestFor: 'Talking to Claude while seeing the diagrams update, or clicking in the UI and letting Claude pick it up.',
    steps: [
      '`kimball serve` serves the guided UI on `localhost` and keeps it in sync with the project file.',
      'Edits from either side appear in the other within about two seconds. If both change the same file at once, the UI asks which version to keep.',
    ],
    code: 'node plugin/skills/kimball-designer/scripts/kimball.mjs serve kimball/project.kimball.json --open',
  },
];

export interface HelpCommand {
  command: string;
  description: string;
}

/** `kimball` CLI commands (Node 18+, no install). Kept in step with the CLI help by a test. */
export const HELP_CLI: HelpCommand[] = [
  { command: 'init [file] --example retail', description: 'Create a project file, optionally from an example (retail, saas, healthcare).' },
  { command: 'serve [file] --open', description: 'Open the guided UI on the file with live sync.' },
  { command: 'summary <file>', description: 'Progress per phase and what to do next.' },
  { command: 'validate <file>', description: 'Check the model against the Kimball rules (`--json`, `--strict`).' },
  { command: 'render <file> --out <dir>', description: 'Write the requirements document, bus matrix and bubble diagrams.' },
  { command: 'ddl <file> --dialect postgres', description: 'Print the CREATE TABLE script with keys and index advice (postgres, sqlserver, snowflake).' },
  { command: 'prototype <file> --out <dir>', description: 'Write the prototype bundle: Docker sandbox, scripts, sample data and index recommendations.' },
  { command: 'guide [phase]', description: 'Coaching notes for a phase: why, what to ask, tips and pitfalls.' },
  { command: 'examples', description: 'List the example projects.' },
];

// ─── Saving and privacy ───

export const HELP_SAVING: HelpOutcome[] = [
  {
    title: 'In the browser',
    text: 'Your project autosaves in this browser’s local storage as you type. It stays on this device only: clearing site data or using a private window removes it, so export a file to keep it.',
  },
  {
    title: 'As a file',
    text: '**Project → Export project file** downloads a `.kimball.json` file. **Open project file** loads one. The file is plain JSON, so it diffs nicely in Git.',
  },
  {
    title: 'With kimball serve',
    text: 'The project file on disk is the source of truth, and the header shows which file you are synced to. If the file and the browser change at the same time, you choose which version wins.',
  },
  {
    title: 'Privacy',
    text: 'Kimball Designer has no backend and no analytics. Nothing you type leaves your machine unless you export or share it yourself; `kimball serve` only listens on `localhost`.',
  },
];

// ─── Glossary ───

export interface HelpTerm {
  term: string;
  definition: string;
}

export const HELP_GLOSSARY: HelpTerm[] = [
  { term: 'Business process', definition: 'A business event that produces measurements, such as taking an order or shipping a parcel. Each becomes a fact table. Name it as a verb or event, not a department.' },
  { term: 'Grain', definition: 'What exactly one row of a fact table represents, for example *one row per product on a receipt*. Declared before dimensions and facts, because it decides both.' },
  { term: 'Fact', definition: 'A numeric measurement taken at the grain, such as quantity or sales amount.' },
  { term: 'Dimension', definition: 'The descriptive context of a fact: who, what, where, when, why and how. Product, Customer and Date are typical dimensions.' },
  { term: 'Conformed dimension', definition: 'A dimension shared by two or more business processes with the same meaning and keys. It is what lets reports drill across processes.' },
  { term: 'Role-playing dimension', definition: 'One dimension used in several roles by the same process, such as Date as *Order date* and *Ship date*.' },
  { term: 'Bus matrix', definition: 'A grid of business processes (rows) against dimensions (columns). The plan for an enterprise warehouse built one process at a time.' },
  { term: 'Bubble diagram', definition: 'A high-level picture of one business process with the dimensions that describe it. Used to agree the model with business people.' },
  ...FACT_TABLE_TYPES.map((o) => ({ term: `${o.label} fact table`, definition: o.description })),
  ...ADDITIVITY.map((o) => ({ term: `${o.label} fact`, definition: o.description })),
  ...DIMENSION_KINDS.filter((o) => o.value !== 'standard').map((o) => ({ term: o.value === 'date' ? 'Date dimension' : `${o.label} dimension`, definition: o.description })),
  { term: 'Surrogate key', definition: 'A meaningless integer that identifies a dimension row. Facts join on it, so history (type 2) and source changes never break the joins.' },
  { term: 'Business key', definition: 'The identifier the source system uses, such as a customer number or SKU. Kept as a dimension attribute; also called the natural key.' },
  { term: 'Slowly changing dimension (SCD)', definition: `How a dimension attribute keeps history when it changes. ${SCD_TYPES.map((o) => `${o.label}: ${o.description.replace(/\.$/, '')}`).join('. ')}.` },
];

// ─── Keyboard shortcuts ───

export interface HelpShortcut {
  keys: string;
  action: string;
}

export const HELP_SHORTCUTS: HelpShortcut[] = [
  { keys: 'Ctrl+Z (⌘Z on Mac)', action: 'Undo' },
  { keys: 'Ctrl+Shift+Z or Ctrl+Y', action: 'Redo' },
  { keys: 'Arrow keys', action: 'Move between cells in the bus matrix' },
  { keys: 'Space or Enter', action: 'Toggle the focused bus matrix cell' },
  { keys: 'Tab / Shift+Tab', action: 'Move through fields and buttons; every control works without a mouse' },
];

// ─── FAQ ───

export interface HelpQuestion {
  q: string;
  a: string;
}

export const HELP_FAQ: HelpQuestion[] = [
  {
    q: 'Do I need Claude to use Kimball Designer?',
    a: 'No. The guided UI works on its own, online or from one offline file. Claude adds an interviewer that asks the right questions and writes the files into your repository.',
  },
  {
    q: 'Does it generate SQL or table designs?',
    a: 'Yes, as a starting point. Phase 11 *Prototype* turns the design into a star schema with a CREATE TABLE script for PostgreSQL, SQL Server or Snowflake, index recommendations, sample data and a Docker sandbox. Review data types and keys in the detailed design before you build for real.',
  },
  {
    q: 'How long does the process take?',
    a: 'The demo takes ten minutes. A real first business process usually takes a few interviews and one or two modelling workshops; the tool keeps each session focused.',
  },
  {
    q: 'Can several people work on one project?',
    a: 'Share the `.kimball.json` file, ideally in a Git repository. One person edits at a time; the file is plain JSON, so changes are easy to review.',
  },
  {
    q: 'Where did my project go?',
    a: 'It is saved in the browser you used. If you cleared site data or switched browsers, open your exported `.kimball.json` file instead.',
  },
  {
    q: 'What do the colours mean?',
    a: 'Teal is a business process (fact), blue a dimension and amber a conformed (shared) dimension, everywhere in the app and the exports.',
  },
  {
    q: 'Can I start from my own notes?',
    a: 'Yes. With the skill, paste interview notes into Claude and ask it to record them. In the browser, use the interview guide in the *Stakeholders* phase.',
  },
  {
    q: 'Is this affiliated with the Kimball Group?',
    a: 'No. Kimball Designer is an independent open-source project that implements techniques popularised by Ralph Kimball and the Kimball Group.',
  },
];

// ─── Markdown ───

export interface HelpMarkdownOptions {
  /** Include screenshots (paths relative to docs/). Off for the skill reference. */
  images?: boolean;
  /** One-line note under the title, e.g. "generated, do not edit". */
  note?: string;
}

/** The whole help content as one Markdown document (docs/USER-GUIDE.md, skill reference). */
export function helpToMarkdown(options: HelpMarkdownOptions = {}): string {
  const { images = true, note } = options;
  const title = (id: PhaseId) => phaseDef(id).title;
  const out: string[] = ['# Kimball Designer user guide', ''];
  if (note) out.push(`<!-- ${note} -->`, '');
  out.push(
    `From first interview to bus matrix. Try it at [kimball.kristinn.eu](${HOSTED_URL}); the same guide is in the app under **Help**.`,
    '',
    ...HELP_SECTIONS.map((s, i) => `${i + 1}. [${s.title}](#${anchor(s.title)})`),
    '',
  );

  const h2 = (id: string) => out.push(`## ${HELP_SECTIONS.find((s) => s.id === id)!.title}`, '');
  const img = (i?: { src: string; alt: string }) => {
    if (images && i) out.push(`![${i.alt}](${i.src})`, '');
  };
  const list = (items: string[]) => out.push(...items.map((x) => `- ${x}`), '');
  const table = (head: string[], rows: string[][]) =>
    out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`), '');

  h2('overview');
  out.push(...HELP_OVERVIEW.intro.flatMap((p) => [p, '']));
  out.push('**Who it is for**', '');
  list(HELP_OVERVIEW.audience);
  out.push(HELP_OVERVIEW.howItFlows, '');

  h2('deliverables');
  out.push(HELP_DELIVERABLES_LEAD, '');
  img({ src: 'images/ui-help.jpg', alt: 'The Help page in the app, showing what the process gives you' });
  out.push('### What the process gives you', '');
  for (const o of HELP_OUTCOMES) out.push(`- **${o.title}.** ${o.text}`);
  out.push('', '### The deliverables', '');
  for (const d of HELP_DELIVERABLES) {
    out.push(`#### ${d.title}`, '', `${d.summary} *(${d.formats})*`, '');
    img(d.image);
    list(d.contains);
    out.push(`**Who uses it:** ${d.usedBy}`, '', `**Why it matters:** ${d.why}`, '', `**Where:** ${d.where}`, '');
  }
  out.push('### What happens next', '');
  list(HELP_NEXT_STEPS);
  out.push('### Not included', '', HELP_NOT_INCLUDED_LEAD, '');
  list(HELP_NOT_INCLUDED);

  h2('phases');
  table(
    ['#', 'Phase', 'You do', 'You record', 'Done when'],
    (Object.keys(HELP_PHASES) as PhaseId[]).map((id, i) => [String(i + 1), `**${title(id)}**`, HELP_PHASES[id].youDo, HELP_PHASES[id].youRecord, HELP_PHASES[id].doneWhen]),
  );

  h2('demos');
  out.push('In the app, open **Help → Demos** and press *Start*: a demo bar walks you through each step in the real UI and ticks steps off as you do them.', '');
  for (const d of HELP_DEMOS) {
    out.push(`### ${d.title} (${d.minutes} min)`, '', d.summary, '');
    img(d.image);
    d.steps.forEach((s, i) => {
      out.push(`${i + 1}. **${s.title}**${s.phase ? ` (${title(s.phase)})` : ''}: ${s.body}`);
      if (s.code) out.push('', '   ```text', ...s.code.split('\n').map((l) => `   ${l}`), '   ```', '');
    });
    out.push('');
  }

  h2('ways');
  for (const w of HELP_WAYS) {
    out.push(`### ${w.title}`, '', `*Best for:* ${w.bestFor}`, '');
    list(w.steps);
    if (w.code) out.push('```text', w.code, '```', '');
  }
  out.push('### Command line', '', 'The `kimball` CLI ships inside the skill and needs only Node 18 or later: `node plugin/skills/kimball-designer/scripts/kimball.mjs <command>`.', '');
  table(['Command', 'What it does'], HELP_CLI.map((c) => [`\`${c.command}\``, c.description]));

  h2('saving');
  for (const s of HELP_SAVING) out.push(`- **${s.title}.** ${s.text}`);
  out.push('');

  h2('glossary');
  for (const t of HELP_GLOSSARY) out.push(`- **${t.term}.** ${t.definition}`);
  out.push('');

  h2('rules');
  out.push(`Errors must be fixed, warnings usually should be, and notes are judgement calls. Details in [METHODOLOGY.md](${REPO_URL}/blob/main/docs/METHODOLOGY.md).`, '');
  table(['Code', 'Severity', 'Rule'], RULES.map((r) => [`\`${r.code}\``, r.severity, r.title]));

  h2('shortcuts');
  table(['Keys', 'Action'], HELP_SHORTCUTS.map((s) => [s.keys, s.action]));

  h2('faq');
  for (const f of HELP_FAQ) out.push(`**${f.q}**`, '', f.a, '');

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** GitHub-style heading anchor. */
function anchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
