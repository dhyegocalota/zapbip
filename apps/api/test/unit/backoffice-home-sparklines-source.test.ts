import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(import.meta.dirname, '../../src/backoffice/home-sparklines.ts'), 'utf8');

describe('the home sparkline queries', () => {
  it('import dailySeries and utcDay instead of defining them', () => {
    expect(SOURCE).toMatch(/import \{[^}]*\bdailySeries\b[^}]*\} from/);
    expect(SOURCE).toMatch(/import \{[^}]*\butcDay\b[^}]*\} from/);
    expect(SOURCE).not.toMatch(/function (dailySeries|utcDay)\b/);
  });
});
