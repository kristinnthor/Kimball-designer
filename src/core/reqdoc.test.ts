import { describe, expect, it } from 'vitest';
import { requirementsToMarkdown } from './reqdoc';
import { loadExample } from './examples';
import { createProject } from './model';

describe('requirementsToMarkdown', () => {
  it('produces every section for a full example', () => {
    const md = requirementsToMarkdown(loadExample('retail'), '2026-11-01T00:00:00.000Z');
    for (const heading of [
      '# Retail analytics — dimensional requirements',
      '## 1. Overview',
      '## 2. Stakeholders',
      '## 3. Business requirements',
      '## 4. Business processes',
      '### 4.1 Retail sales',
      '## 5. Dimensions',
      '## 6. Enterprise bus matrix',
      '## 7. Prioritisation',
      '## 8. Assumptions and open questions',
      '## 9. Validation summary',
    ]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain('```mermaid');
    expect(md).toContain('| R1 | Which categories and brands are growing, by store, region and week? |');
    expect(md).toContain('0 error(s), 0 warning(s)');
    expect(md).not.toMatch(/\n{3,}/);
  });

  it('handles an empty project gracefully', () => {
    const md = requirementsToMarkdown(createProject(), '2026-11-01T00:00:00.000Z');
    expect(md).toContain('# Untitled project — dimensional requirements');
    expect(md).toContain('_No business processes recorded._');
  });
});
