import { describe, expect, it } from 'vitest';
import { crc32, createZip } from './zip';

describe('zip writer', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes local headers, a central directory and an end record', () => {
    const zip = createZip(
      [
        { name: 'a.txt', data: 'hello' },
        { name: 'dir/b.md', data: '# ünïcode' },
      ],
      new Date(2026, 10, 1, 12, 0, 0),
    );
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2); // entries
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('hello');
    expect(text).toContain('dir/b.md');
    expect(text).toContain('# ünïcode');
  });
});
