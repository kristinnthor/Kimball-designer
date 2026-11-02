<p align="center">
  <img src="logo-lockup.svg" alt="Kimball Designer" width="400">
</p>

# Kimball Designer — brand guidelines

> **From first interview to bus matrix.**

Kimball Designer helps developers and data teams run Kimball-style business requirements gathering and turn it into **bubble diagrams** and an **enterprise bus matrix**. The brand should feel like a calm, competent modelling coach: precise, friendly, never academic.

---

## 1. Name

| Use | Form |
|---|---|
| Product name | **Kimball Designer** (two words, both capitalised) |
| Short form (UI tight spaces) | **KD** |
| CLI / skill / plugin id | `kimball` (CLI), `kimball-designer` (skill & plugin) |
| Project files | `*.kimball.json` |

Don't write "KimballDesigner", "Kimball designer" or "the Kimball tool".

## 2. Logo

<p>
  <img src="logo-mark.svg" alt="Logo mark" width="96">
  &nbsp;&nbsp;
  <img src="logo-lockup.svg" alt="Light lockup" width="320">
</p>

**The idea.** A teal **fact bubble** at the centre, five **dimension bubbles** around it — one of them amber because it is **conformed** — set on a tile whose faint grid hints at the **bus matrix**. It is literally the bubble chart the tool produces, sitting on the matrix it builds.

| File | Use |
|---|---|
| [`logo-mark.svg`](logo-mark.svg) | App icon, favicon, avatars, small sizes (≥ 16 px) |
| [`logo-lockup.svg`](logo-lockup.svg) | README header and documents on light backgrounds |
| [`logo-lockup-dark.svg`](logo-lockup-dark.svg) | Dark backgrounds |
| [`social-preview.svg`](social-preview.svg) · [`.png`](social-preview.png) | GitHub social preview / link cards (1280 × 640) |
| [`logo-mark-512.png`](logo-mark-512.png) | Raster icon (avatars, marketplaces) |
| [`favicon.svg`](favicon.svg) | Browser tab icon |

PNGs are rendered from the SVGs with `node scripts/render-brand.mjs`.

**Clear space:** at least ¼ of the mark's width on every side.
**Minimum size:** mark 16 px; lockup 160 px wide.

**Don't:** recolour individual bubbles, add more satellites, rotate the mark, place the light lockup on dark backgrounds, add drop shadows or outlines.

## 3. Colour

Colour carries **meaning** in this product. The same three colours are used in the UI, in every bubble diagram and in the bus matrix, so a user learns them once.

| Role | Token | Light | Dark | Meaning |
|---|---|---|---|---|
| Fact | `--kd-fact` | ![](swatches/fact.svg) `#0E9F9A` | `#2CC3BD` | Business process / fact table |
| Dimension | `--kd-dim` | ![](swatches/dim.svg) `#4C6FFF` | `#7D95FF` | Dimension |
| Conformed | `--kd-conformed` | ![](swatches/conformed.svg) `#F4A62A` | `#FFC15E` | Conformed dimension, bus matrix marks, highlights |
| Ink | `--kd-ink` | ![](swatches/ink.svg) `#14213D` | `#E6EAF2` | Primary text, logo tile |
| Paper | `--kd-paper` | ![](swatches/paper.svg) `#F7F8FB` | `#0B1222` | App background |

Each semantic colour has a `-strong` variant that is safe for **text** (≥ 4.5 : 1 on the surface colours) and a `-soft` variant for **tinted backgrounds**. Use the base colour only for fills, strokes and large graphics.

Status colours: success `#157A41`, warning `#B45309`, danger `#C62828` (dark-mode variants in [`tokens.css`](tokens.css)).

**Accessibility rules**
- Body text and controls meet WCAG 2.2 AA in both themes.
- Never rely on colour alone: conformed dimensions also get a heavier outline and a label; matrix cells use a mark (`●`/`X`) not only a fill.

## 4. Typography

| Use | Typeface | Fallback |
|---|---|---|
| UI & documents | **Inter** (600–800 headings, 400–500 body) | system UI stack |
| Grain statements, IDs, code | **JetBrains Mono** | `ui-monospace`, Consolas |

The web UI ships **no web fonts** (it must run offline from a single file), so it uses the system stack and gets Inter only when it is installed. That is intended.

Scale: 12 / 14 / 16 / 20 / 26 / 34 px. Headings use tight letter-spacing (−0.01 em to −0.02 em).

## 5. Shape, space and elevation

- 4 px spacing grid (`--kd-space-*`).
- Radii: 6 px controls, 10 px cards, 16 px panels; pills for status chips.
- Elevation is subtle: one hairline border + `--kd-shadow-1`. Avoid heavy shadows.
- Bubbles are always **circles**; process bubbles are larger than dimension bubbles.

## 6. The four stages

The user journey is branded as four stages. Use these names and colours consistently in UI, docs and the skill.

| Stage | Colour | Phases |
|---|---|---|
| **Discover** | Fact teal | Kickoff · Stakeholders · Requirements |
| **Model** | Dimension indigo | Business processes · Grain · Dimensions · Facts |
| **Deliver** | Conformed amber | Bubble diagrams · Bus matrix · Review & export |
| **Build** | Ink | Prototype |

## 7. Voice and tone

Kimball Designer speaks like an experienced data-warehouse architect who is a good teacher.

| We are | We are not |
|---|---|
| **Coaching** — "Start with the business events people already talk about." | Lecturing — "As per the methodology you must…" |
| **Plain** — "One row per order line." | Jargon-first — "Atomic transactional granularity." |
| **Precise** — uses *grain*, *conformed*, *semi-additive* correctly, and explains them once | Vague — "data stuff", "tables and things" |
| **Honest** — "We still don't know who owns returns data — added to open questions." | Inventive — never fills gaps with made-up business facts |

Writing rules:
- Sentence case for headings and buttons ("Add dimension", not "Add Dimension").
- Buttons are verbs. Empty states explain *why* and offer one action.
- Name business processes as **events** ("Retail sales", "Claims submitted"), not departments or reports.
- Prefer "you" and "your stakeholders"; avoid "the user".

## 8. Diagrams

Bubble diagrams and the bus matrix are part of the brand. They must:
- Use fact teal for the process bubble, dimension indigo for dimensions, amber outline + label for conformed dimensions.
- Show the **grain** under every bubble diagram.
- Render legibly in both themes and in print (white background export).

## 9. Independence notice

Kimball Designer is an independent open-source project. It implements dimensional-modelling techniques popularised by Ralph Kimball and the Kimball Group, but is **not affiliated with or endorsed by** them. Don't use Kimball Group logos, book covers or trademarks in Kimball Designer materials.
