import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('zustand selectors', () => {
  it('does not derive fresh arrays inside store selectors used by mounted components', () => {
    const files = ['src/dashboard/components/BulkActionBar.tsx', 'src/dashboard/components/Spotlight.tsx'];
    const source = files.map((file) => readFileSync(join(root, file), 'utf8')).join('\n');
    const storeSelectorLines = source.split('\n').filter((line) => line.includes('useLinkscapeStore((state)'));

    expect(storeSelectorLines.some((line) => line.includes('.filter('))).toBe(false);
    expect(storeSelectorLines.some((line) => line.includes('searchResults()'))).toBe(false);
  });
});
