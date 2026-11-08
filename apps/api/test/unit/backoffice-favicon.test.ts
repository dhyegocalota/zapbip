import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAVICON_SVG } from '../../src/backoffice/assets/favicon';

const DOCS_FAVICON_PATH = '../docs/favicon.svg';

describe('backoffice favicon', () => {
  it('pin: is the same mark as the docs favicon', () => {
    expect(FAVICON_SVG).toBe(readFileSync(DOCS_FAVICON_PATH, 'utf8').trim());
  });
});
