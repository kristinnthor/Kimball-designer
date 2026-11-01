/** Small, dependency-free text helpers shared by the exporters. */

export function escapeXml(s: string): string {
  return s
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
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

/**
 * Greedy word wrap into at most `maxLines` lines of about `maxChars` characters.
 * Over-long words are hard-split; overflow on the last line is ellipsised.
 */
export function wrapText(text: string, maxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(2, Math.floor(maxWidth));
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  const push = (line: string) => lines.push(line);
  for (let word of words) {
    while (word.length > maxChars) {
      if (current) {
        push(current);
        current = '';
      }
      push(word.slice(0, maxChars - 1) + '-');
      word = word.slice(maxChars - 1);
    }
    if (!current) current = word;
    else if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
    else {
      push(current);
      current = word;
    }
  }
  if (current) push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1]!;
    kept[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + '…';
    return kept;
  }
  return lines;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Joins with commas and a final "and". */
export function humanList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
