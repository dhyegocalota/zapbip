import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DocsLanguage, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { DOCS_ROOT, PAGE_EXTENSION, capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_CONFIG_FILE = `${DOCS_ROOT}/docs.json`;
const LOGO_VIEW_BOX = 'viewBox="0 0 120 32"';
const LOGO_ROLE = 'role="img"';
const LOGO_TITLE = '<title>zapbip</title>';
const LOGO_WIDTH_PATTERN = /<svg\b[^>]*\swidth="\d+"/;
const LOGO_HEIGHT_PATTERN = /<svg\b[^>]*\sheight="\d+"/;
const HERO_SNIPPET_FILE = `${DOCS_ROOT}/snippets/hero.jsx`;
const HERO_SIGNATURE_PATTERN = /export const Hero = \(\{ eyebrow, statement, accent, lead, primary, secondary, children \}\) =>/;
const HEADING_TAG_PATTERN = /<h[1-6]\b/;
const STATEMENT_PARAGRAPH_PATTERN = /<p\b[^>]*>\s*\{statement\}/;
const LINK_ANCHOR_PATTERN = /<a\b[^>]*href=\{(primary|secondary)\.href\}/g;
const HERO_OPENING_PATTERN = /<Hero\b([\s\S]*?)\n>/;
const HERO_PROP_NAME_PATTERN = /^ {2}(\w+)=/gm;
const HERO_TEXT_PROP_PATTERN = /^ {2}(\w+)="([^"]*)"/gm;
const HERO_LINK_PATTERN = /^ {2}(primary|secondary)=\{\{ label: '([^']+)', href: '([^']+)' \}\}/gm;
const IMPORT_PATTERN = /^import .*$/gm;
const FIRST_SECTION_HEADING = /^## /m;
const HERO_STATEMENT_MAX_WORDS = 7;
const WORD_SEPARATOR = /\s+/;
const OVERVIEW_PAGES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'index',
  [DocsLanguage.PortugueseBrazil]: `${PAGE_LANGUAGE_FOLDER}/index`,
};
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

type HeroLink = { name: string; label: string; href: string };
type HeroProps = { names: string[]; texts: Record<string, string>; links: HeroLink[] };

function overviewOf({ language }: { language: DocsLanguage }): string {
  return readRepositoryFile(`${DOCS_ROOT}/${OVERVIEW_PAGES[language]}${PAGE_EXTENSION}`);
}

function heroOpeningOf({ language }: { language: DocsLanguage }): string {
  const opening = overviewOf({ language }).match(HERO_OPENING_PATTERN);
  if (!opening) throw new Error(`${OVERVIEW_PAGES[language]} has no Hero`);
  return opening[0];
}

function heroPropsOf({ language }: { language: DocsLanguage }): HeroProps {
  const opening = heroOpeningOf({ language });
  const texts = [...opening.matchAll(HERO_TEXT_PROP_PATTERN)].map((match) => [match[1], match[2]] as [string, string]);
  const links = [...opening.matchAll(HERO_LINK_PATTERN)].map((match) => ({ name: match[1], label: match[2], href: match[3] }) as HeroLink);
  return { names: capturedNames({ text: opening, pattern: HERO_PROP_NAME_PATTERN }), texts: Object.fromEntries(texts), links };
}

describe('docs visual: hero snippet', () => {
  test('it exports Hero with the agreed props', () => {
    expect(readRepositoryFile(HERO_SNIPPET_FILE)).toMatch(HERO_SIGNATURE_PATTERN);
  });

  test('it renders no heading and the statement as a paragraph', () => {
    const source = readRepositoryFile(HERO_SNIPPET_FILE);
    expect(source).not.toMatch(HEADING_TAG_PATTERN);
    expect(source).toMatch(STATEMENT_PARAGRAPH_PATTERN);
  });

  test('primary and secondary are real links', () => {
    expect(capturedNames({ text: readRepositoryFile(HERO_SNIPPET_FILE), pattern: LINK_ANCHOR_PATTERN }).sort()).toEqual([
      'primary',
      'secondary',
    ]);
  });
});

describe('docs visual: hero on the Overview pages', () => {
  test.each(Object.values(DocsLanguage))('the %s Overview places Hero after the imports and above the first section', (language) => {
    const markdown = overviewOf({ language });
    const lastImportEnd = [...markdown.matchAll(IMPORT_PATTERN)].map((match) => match.index + match[0].length).at(-1);
    const heroStart = markdown.indexOf('<Hero');
    const firstSectionStart = markdown.search(FIRST_SECTION_HEADING);
    expect(lastImportEnd).toBeLessThan(heroStart);
    expect(heroStart).toBeLessThan(firstSectionStart);
    expect(markdown).toContain("import { Hero } from '/snippets/hero.jsx';");
  });

  test('both Overview pages pass the same set of props', () => {
    const english = heroPropsOf({ language: DocsLanguage.English });
    const portuguese = heroPropsOf({ language: DocsLanguage.PortugueseBrazil });
    expect([...english.names].sort()).toEqual(['accent', 'eyebrow', 'lead', 'primary', 'secondary', 'statement']);
    expect([...portuguese.names].sort()).toEqual([...english.names].sort());
  });

  test('no pt-BR prop equals its English counterpart', () => {
    const english = heroPropsOf({ language: DocsLanguage.English });
    const portuguese = heroPropsOf({ language: DocsLanguage.PortugueseBrazil });
    const sameTexts = Object.keys(english.texts).filter((name) => english.texts[name] === portuguese.texts[name]);
    const sameLabels = english.links.filter((link) =>
      portuguese.links.some((other) => other.name === link.name && other.label === link.label),
    );
    expect([...sameTexts, ...sameLabels.map((link) => link.name)]).toEqual([]);
  });

  test.each(Object.values(DocsLanguage))('the %s links point at existing pages', (language) => {
    const { links } = heroPropsOf({ language });
    const prefix = language === DocsLanguage.English ? '/' : `/${PAGE_LANGUAGE_FOLDER}/`;
    expect(links.map((link) => link.name).sort()).toEqual(['primary', 'secondary']);
    expect(links.filter((link) => !link.href.startsWith(prefix))).toEqual([]);
    expect(links.filter((link) => !existsSync(repositoryPath(`${DOCS_ROOT}${link.href}${PAGE_EXTENSION}`)))).toEqual([]);
  });

  test.each(Object.values(DocsLanguage))('the %s statement is under eight words', (language) => {
    const { statement } = heroPropsOf({ language }).texts;
    expect(statement?.split(WORD_SEPARATOR).length).toBeLessThanOrEqual(HERO_STATEMENT_MAX_WORDS);
  });
});
