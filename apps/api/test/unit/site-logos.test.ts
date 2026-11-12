import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { describe, expect, it } from 'vitest';

const LOGOS_ROOT = join(import.meta.dirname, '../../site-public/site/logos');
const NOTICE_FILE = 'NOTICE.md';
const LOGO_LIMIT_BYTES = 4_000;
const INSTALLS = Object.entries(AGENT_INSTALLS);

function logoPathOf(input: { id: string }): string {
  return join(LOGOS_ROOT, `${input.id}.svg`);
}

describe('the official logos', () => {
  it.each(INSTALLS)('ships a file for %s exactly when the install facet says it has an official logo', (id, install) => {
    expect(existsSync(logoPathOf({ id }))).toBe(install.hasOfficialLogo);
  });

  it.each(INSTALLS.filter(([, install]) => install.hasOfficialLogo))('keeps the logo of %s small, drawn and inert', (id) => {
    const svg = readFileSync(logoPathOf({ id }), 'utf8');
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(LOGO_LIMIT_BYTES);
    expect(svg).toContain('viewBox=');
    expect(svg).toMatch(/<path /);
    expect(svg).not.toMatch(/<script|onload|href=|<image|<style/i);
  });

  it.each(INSTALLS.filter(([, install]) => install.hasOfficialLogo))('records the source and the licence of the logo of %s', (id) => {
    const notice = readFileSync(join(LOGOS_ROOT, NOTICE_FILE), 'utf8');
    const line = notice.split('\n').find((candidate) => candidate.includes(`${id}.svg`));
    expect(line).toBeDefined();
    expect(line).toContain('CC0-1.0');
    expect(line).toMatch(/https:\/\//);
  });
});
