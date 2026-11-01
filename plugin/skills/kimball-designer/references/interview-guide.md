# Stakeholder interview guide

Kimball requirements come from short, structured interviews. Use this guide to plan interviews, to give the user an interview pack, or to interview the user directly in chat.

## Before the interview

- **Who:** group by role (executives separately from analysts). Two to four people per session is ideal.
- **Team:** one facilitator asks, one scribe writes. In chat, you are the facilitator and the project file is the scribe.
- **Prep:** read existing reports and org charts; know the stakeholder's area.
- **Agenda (send ahead):** "We want to understand the decisions you make, how you measure success and where information falls short. No technical preparation needed."
- **Length:** 60 minutes for managers, 30 for executives.

## Interview flow

1. **Introduce** (2 min) — purpose of the program, what happens with the answers.
2. **Responsibilities** (10 min) — what the person and their team do; which business events they manage.
3. **Decisions and measures** (20 min) — which decisions they make, how success is measured, which KPIs matter.
4. **Analysis needs** (15 min) — how they slice the numbers (by what, at what level, over which period); history and freshness.
5. **Pain points** (10 min) — what is slow, disputed or impossible today.
6. **Wrap-up** (3 min) — who else to talk to; what success looks like for them.

Avoid asking "what data do you want?" — you'll get a list of source fields. Ask about **decisions, measures and questions** instead.

## Question banks

`$KD guide stakeholders` prints the same banks.

### Executive
- What are the organisation's objectives for the next year? How is success measured?
- Which decisions would you make differently with better information?
- What are the biggest risks or problems in your area right now?
- How do you compare performance today — over time, against plan, against competitors?
- What would make this program a success in your eyes?

### Business manager
- Describe your team's responsibilities. What events or activities do you manage?
- Which reports do you use today? What do you do with them? What is missing?
- How do you measure your team's performance? Which KPIs?
- How do you need to slice those numbers — by product, customer, region, time…?
- How far back do you need history, and how current must the data be?

### Analyst / power user
- Which analyses do you run most often, and how long do they take?
- Where does the data come from today, and how much manual work is involved?
- Which numbers are disputed or reconciled by hand?
- Which questions are you asked that you cannot answer?
- Which definitions differ between departments (customer, revenue, active)?

### IT / source-system owner
- Which systems capture these business events? At what level of detail?
- How reliable is the data? Known quality issues, late or missing records?
- How are changes captured — updates in place, history tables, change logs?
- Which identifiers link systems together (customer id, product code)?
- Are there constraints on access, volume, privacy or load windows?

## Turning answers into the model

| You hear | Record as |
|---|---|
| "I need to know which promotions worked" | `requirements[]` statement; KPI "promotion lift" |
| "We report on-time delivery % every week" | KPI on a requirement; later a fact (on-time count ÷ total, stored as two additive facts) |
| "Every scan at the till…", "when a claim is adjudicated…" | a business process (event) |
| "…by store, by week, by category" | dimensions (Store, Date, Product) |
| "…per order line" | the grain |
| "Finance and Sales define customer differently" | open question + candidate conformed dimension |
| "We assume returns come from the POS" | assumption |

After each interview, set the stakeholder's `interviewStatus` to `done` and summarise the notes in `notes` (decisions, measures, pain points — three to six bullet-style lines).

## Interview pack template (for the user to take into a meeting)

```markdown
# Interview: <name>, <role> — <date>

Purpose: understand the decisions you make and the information you need for <program>.

1. <question tailored from the bank above>
2. …
(6–8 questions max)

Notes:
- Decisions:
- Measures / KPIs:
- How they slice it:
- Pain points:
- Others to talk to:
```
