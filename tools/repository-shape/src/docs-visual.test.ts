import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_CONFIG_FILE = `${DOCS_ROOT}/docs.json`;
const LOGO_VIEW_BOX = 'viewBox="0 0 120 32"';
const LOGO_ROLE = 'role="img"';
const LOGO_TITLE = '<title>zapbip</title>';
const LOGO_WIDTH_PATTERN = /<svg\b[^>]*\swidth="\d+"/;
const LOGO_HEIGHT_PATTERN = /<svg\b[^>]*\sheight="\d+"/;
const FILL_PATTERN = /fill="(#[0-9A-Fa-f]{6})"/g;

type DocsLogo = { light?: string; dark?: string; href?: string };
type DocsVisualConfig = { logo?: DocsLogo };

function docsVisualConfig(): DocsVisualConfig {
  return JSON.parse(readRepositoryFile(DOCS_CONFIG_FILE));
}

function logoPathOf({ theme }: { theme: keyof DocsLogo }): string {
  const path = docsVisualConfig().logo?.[theme];
  if (!path) throw new Error(`docs.json has no logo.${theme}`);
  return path;
}

function logoSourceOf({ theme }: { theme: keyof DocsLogo }): string {
  return readRepositoryFile(`${DOCS_ROOT}${logoPathOf({ theme })}`);
}

function fillsOf({ source }: { source: string }): string[] {
  return capturedNames({ text: source, pattern: FILL_PATTERN }).map((fill) => fill.toUpperCase());
}

describe('docs visual: logo', () => {
  test('docs.json names a light logo, a dark logo and the Overview as the link', () => {
    const logo = docsVisualConfig().logo;
    expect(logo?.light).toBeTypeOf('string');
    expect(logo?.dark).toBeTypeOf('string');
    expect(logo?.href).toBe('/');
  });

  test.each(['light', 'dark'] as const)('the %s logo is a committed SVG with size, viewBox, role and title', (theme) => {
    const path = logoPathOf({ theme });
    expect(existsSync(repositoryPath(`${DOCS_ROOT}${path}`))).toBe(true);
    const source = logoSourceOf({ theme });
    expect(source).toMatch(LOGO_WIDTH_PATTERN);
    expect(source).toMatch(LOGO_HEIGHT_PATTERN);
    expect(source).toContain(LOGO_VIEW_BOX);
    expect(source).toContain(LOGO_ROLE);
    expect(source).toContain(LOGO_TITLE);
  });

  test('the dark logo uses different colours from the light one', () => {
    expect(fillsOf({ source: logoSourceOf({ theme: 'dark' }) })).not.toEqual(fillsOf({ source: logoSourceOf({ theme: 'light' }) }));
  });
});
