import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { describe, expect, it } from 'vitest';

const LOGOS_ROOT = join(import.meta.dirname, '../../site-public/site/logos');
const NOTICE_FILE = 'NOTICE.md';
const LOGO_LIMIT_BYTES = 4_000;
const FORBIDDEN_MARKS = ['grok', 'xai'];
const NOTICE_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const STEMS = [
  ...new Set(Object.values(AGENT_INSTALLS).flatMap((install) => (install.officialLogo === null ? [] : [install.officialLogo]))),
];

function logoFileOf(input: { stem: string }): string {
  return join(LOGOS_ROOT, `${input.stem}.svg`);
}

describe('the official logos', () => {
  it.each(STEMS)('ships the file %s.svg that its agents name', (stem) => {
    expect(existsSync(logoFileOf({ stem }))).toBe(true);
  });

  it.each(STEMS)('keeps %s.svg small, drawn and inert', (stem) => {
    const svg = readFileSync(logoFileOf({ stem }), 'utf8');
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(LOGO_LIMIT_BYTES);
    expect(svg).toContain('viewBox=');
    expect(svg).toMatch(/<path /);
    expect(svg).not.toMatch(/<script|onload|href=|<image|<style/i);
  });

  it.each(STEMS)('records the source and the licence of %s.svg', (stem) => {
    const notice = readFileSync(join(LOGOS_ROOT, NOTICE_FILE), 'utf8');
    const line = notice.split('\n').find((candidate) => candidate.includes(`${stem}.svg`));
    expect(line).toBeDefined();
    expect(line).toMatch(/https:\/\//);
    expect(line).toMatch(NOTICE_DATE_PATTERN);
  });

  it('keeps one file per mark: no two logo files are the same drawing', () => {
    const drawings = readdirSync(LOGOS_ROOT)
      .filter((name) => name.endsWith('.svg'))
      .map((name) => readFileSync(join(LOGOS_ROOT, name), 'utf8'));
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it('shows initials for the agents whose vendor offers no lawful copy of its mark', () => {
    const markedWithLogo = Object.entries(AGENT_INSTALLS)
      .filter(([client, install]) => FORBIDDEN_MARKS.some((mark) => client.includes(mark)) && install.officialLogo !== null)
      .map(([client]) => client);
    expect(markedWithLogo).toEqual([]);
  });

  it('ships no mark its owner has not allowed, and no file that is not an svg or the notice', () => {
    const files = readdirSync(LOGOS_ROOT);
    FORBIDDEN_MARKS.forEach((mark) => {
      expect(files.filter((name) => name.toLowerCase().includes(mark))).toEqual([]);
    });
    expect(files.filter((name) => !name.endsWith('.svg') && name !== NOTICE_FILE)).toEqual([]);
  });
});
