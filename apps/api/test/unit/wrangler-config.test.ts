import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PUBLIC_ORIGIN_PATTERN = /"PUBLIC_ORIGIN":\s*"([^"]+)"/;
const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';

describe('wrangler config', () => {
  it('pin: the top-level production block serves an https origin', () => {
    const topLevelOrigin = PUBLIC_ORIGIN_PATTERN.exec(readFileSync(WRANGLER_CONFIG_PATH, 'utf8'))?.[1];
    expect(topLevelOrigin).toMatch(/^https:\/\//);
  });
});
