import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSETS_ROOT = join(import.meta.dirname, '../../site-public/site');
const PER_FILE_LIMIT_BYTES = 2_000_000;
const TOTAL_LIMIT_BYTES = 6_000_000;
const EXPECTED_FILES = ['demo-960.mp4', 'demo-960.webm', 'demo-poster-960.webp', 'demo-poster-540.webp', 'og.png', 'apple-touch-icon.png'];
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_LIMIT_BYTES = 300_000;
const MP4_LIMIT_BYTES = 1_500_000;
const WEBM_LIMIT_BYTES = 1_100_000;
const POSTER_LIMIT_BYTES = 80_000;

function sizeOf(name: string): number {
  return statSync(join(ASSETS_ROOT, name)).size;
}

describe('site assets', () => {
  it.each(EXPECTED_FILES)('ships %s', (name) => {
    expect(readdirSync(ASSETS_ROOT)).toContain(name);
  });

  it('keeps every file under 2 MB and the total under 6 MB', () => {
    const sizes = readdirSync(ASSETS_ROOT).map(sizeOf);
    expect(sizes.filter((size) => size >= PER_FILE_LIMIT_BYTES)).toEqual([]);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThan(TOTAL_LIMIT_BYTES);
  });

  it('keeps each asset inside its own budget', () => {
    expect(sizeOf('demo-960.mp4')).toBeLessThanOrEqual(MP4_LIMIT_BYTES);
    expect(sizeOf('demo-960.webm')).toBeLessThanOrEqual(WEBM_LIMIT_BYTES);
    expect(sizeOf('demo-poster-960.webp')).toBeLessThanOrEqual(POSTER_LIMIT_BYTES);
    expect(sizeOf('og.png')).toBeLessThanOrEqual(OG_LIMIT_BYTES);
  });

  it('draws the Open Graph image at 1200 by 630', () => {
    const header = readFileSync(join(ASSETS_ROOT, 'og.png'));
    expect(header.readUInt32BE(PNG_WIDTH_OFFSET)).toBe(OG_WIDTH);
    expect(header.readUInt32BE(PNG_HEIGHT_OFFSET)).toBe(OG_HEIGHT);
  });
});
