/** Small, dependency-free text helpers shared by the exporters. */

/** C0 control characters XML 1.0 forbids (tab, newline and carriage return are allowed). */
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function escapeXml(s: string): string {
  return s
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes text for use inside a Markdown table cell. */
export function mdCell(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim();
}

/**
 * Escapes user text for running Markdown outside tables (headings, list items,
 * paragraphs): HTML is neutralised, emphasis and link characters are escaped and
 * newlines become spaces, so text can never start a new heading or list item.
 */
export function mdInline(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([`*_[\]|])/g, '\\$1')
    .replace(/\s*\r?\n\s*/g, ' ')
    .trim()
    .replace(/^([#+-])/, '\\$1')
    .replace(/^(\d+)([.)])/, '$1\\$2');
}

/** A Markdown code span that survives backticks and newlines in the text. */
export function mdCode(s: string): string {
  const text = s.replace(/\s*\r?\n\s*/g, ' ').trim();
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** CSV cell with quoting. Values a spreadsheet would run as a formula get a leading apostrophe. */
export function csvCell(s: string): string {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function slugify(s: string, fallback = 'item'): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/**
 * Greedy word wrap into at most `maxLines` lines of about `maxChars` characters.
 * Over-long words are hard-split; overflow on the last line is ellipsised.
 */
export function wrapText(text: string, maxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(2, Math.floor(maxWidth));
  // Work in code points so emoji and other astral characters are never cut in half.
  const words = text.trim().split(/\s+/).filter(Boolean).map((w) => Array.from(w));
  const lines: string[] = [];
  let current: string[] = [];
  const push = (line: string[]) => lines.push(line.join(''));
  for (let word of words) {
    while (word.length > maxChars) {
      if (current.length) {
        push(current);
        current = [];
      }
      push([...word.slice(0, maxChars - 1), '-']);
      word = word.slice(maxChars - 1);
    }
    if (!current.length) current = word;
    else if (current.length + 1 + word.length <= maxChars) current = [...current, ' ', ...word];
    else {
      push(current);
      current = word;
    }
  }
  if (current.length) push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = Array.from(kept[maxLines - 1]!);
    kept[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1).join('') : last.join('')) + '…';
    return kept;
  }
  return lines;
}

export function truncate(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : s;
}

/** Joins with commas and a final "and". */
export function humanList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
