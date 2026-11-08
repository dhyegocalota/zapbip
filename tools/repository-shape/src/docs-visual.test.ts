import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DocsLanguage, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { compositeOver, contrastOf } from './contrast';
import { DOCS_ROOT, REPOSITORY_ROOT, PAGE_EXTENSION, capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

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
const CHAT_SNIPPET_FILE = `${DOCS_ROOT}/snippets/chat.jsx`;
const CHAT_COLOUR_PATTERN = /^ {2}const (\w+) = '(#[0-9A-Fa-f]{6})';$/gm;
const TEAL_TEXT_PATTERN = /\bcolor: teal\b/;
const CHAT_PROPS_PATTERN = /export const Chat = \(\{[^}]*\bframe\b[^}]*\}\)/;
const TYPING_MESSAGE_PATTERN = /message\.typing/;
const TYPING_CLASS = 'className="zapbip-typing"';
const TYPING_HIDDEN_PATTERN =
  /<div\b[^>]*aria-hidden="true"[^>]*className="zapbip-typing"|<div\b[^>]*className="zapbip-typing"[^>]*aria-hidden="true"/;
const SENT_BUBBLE = '#D9FDD3';
const NOTICE_BUBBLE = '#FFEECD';
const STYLESHEET_FILE = `${DOCS_ROOT}/zapbip.css`;
const HERO_CLASSES = [
  'zapbip-hero',
  'zapbip-hero-copy',
  'zapbip-hero-visual',
  'zapbip-hero-eyebrow',
  'zapbip-hero-statement',
  'zapbip-hero-accent',
  'zapbip-hero-lead',
  'zapbip-hero-actions',
  'zapbip-button-primary',
  'zapbip-button-secondary',
  'zapbip-typing',
];
const MOTION_BLOCK_PATTERN = /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/;
const KEYFRAMES_PATTERN = /@keyframes/;
const IMPORT_RULE_PATTERN = /@import/;
const FOREIGN_URL_PATTERN = /url\(\s*['"]?(?:https?:)?\/\//;
const FORCED_COLORS_PATTERN = /@media \(forced-colors: active\)/;
const LIGHT_GLOW = 'rgb(37 211 102 / 0.22)';
const DARK_GLOW = 'rgb(37 211 102 / 0.14)';
const LIGHT_HERO_START = '#FFFFFF';
const LIGHT_HERO_END = '#F1F7F3';
const DARK_HERO_BASE = '#0D1B17';
const DARK_PREFIX = '.dark ';
const BASELINE_REFERENCE = 'origin/main';
const LIGHT_PAGE = '#F6F8F5';
const DARK_PAGE = '#07120F';
const WHITE = '#FFFFFF';
const BODY_TEXT_CONTRAST = 4.5;
const LARGE_ELEMENT_CONTRAST = 3;
const FILL_PATTERN = /fill="(#[0-9A-Fa-f]{6})"/g;

type DocsLogo = { light?: string; dark?: string; href?: string };
type DocsVisualConfig = {
  theme?: string;
  favicon?: string;
  logo?: DocsLogo;
  colors?: { primary?: string; light?: string; dark?: string };
  background?: { color?: { light?: string; dark?: string }; decoration?: string };
  appearance?: { default?: string };
  navigation?: unknown;
};

function docsVisualConfig(): DocsVisualConfig {
  return JSON.parse(readRepositoryFile(DOCS_CONFIG_FILE));
}

function baselineConfig(): DocsVisualConfig {
  const shown = spawnSync('git', ['show', `${BASELINE_REFERENCE}:${DOCS_CONFIG_FILE}`], { cwd: REPOSITORY_ROOT, encoding: 'utf8' });
  if (shown.status !== 0) throw new Error(`git show failed: ${shown.stderr}`);
  return JSON.parse(shown.stdout);
}

function requiredColour({ colour, name }: { colour?: string; name: string }): string {
  if (!colour) throw new Error(`docs.json has no ${name}`);
  return colour;
}

function chatColoursOf(): Record<string, string> {
  const source = readRepositoryFile(CHAT_SNIPPET_FILE);
  return Object.fromEntries([...source.matchAll(CHAT_COLOUR_PATTERN)].map((match) => [match[1], match[2]]));
}

function chatColourOf({ name }: { name: string }): string {
  const colour = chatColoursOf()[name];
  if (!colour) throw new Error(`chat.jsx has no ${name} colour`);
  return colour;
}

function declarationOf({ selector, property }: { selector: string; property: string }): string {
  const stylesheet = readRepositoryFile(STYLESHEET_FILE);
  const rule = stylesheet.split('}').find((chunk) => chunk.trim().split('{')[0]?.trim() === selector);
  const declaration = rule?.match(new RegExp(`(?:^|[\\s;{])${property}:\\s*([^;]+);`))?.[1];
  if (!declaration) throw new Error(`zapbip.css has no ${property} on ${selector}`);
  return declaration.trim();
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

describe('docs visual: theme', () => {
  test('the primary colour is the AA teal on both light pages', () => {
    const primary = requiredColour({ colour: docsVisualConfig().colors?.primary, name: 'colors.primary' });
    expect(primary).toBe('#0B6B60');
    expect(contrastOf({ foreground: primary, background: WHITE })).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
    expect(contrastOf({ foreground: primary, background: LIGHT_PAGE })).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  });

  test('the dark accent is the signal green and passes on the dark page', () => {
    const accent = requiredColour({ colour: docsVisualConfig().colors?.light, name: 'colors.light' });
    expect(accent).toBe('#25D366');
    expect(contrastOf({ foreground: accent, background: DARK_PAGE })).toBeGreaterThanOrEqual(LARGE_ELEMENT_CONTRAST);
  });

  test('the page colours, the glow, the default appearance and the theme are set', () => {
    const config = docsVisualConfig();
    expect(config.background?.color).toEqual({ light: LIGHT_PAGE, dark: DARK_PAGE });
    expect(config.background?.decoration).toBe('gradient');
    expect(config.appearance?.default).toBe('system');
    expect(config.theme).toBe('mint');
  });

  test('the favicon and the navigation are unchanged from the baseline', () => {
    const config = docsVisualConfig();
    const baseline = baselineConfig();
    expect(config.favicon).toBe(baseline.favicon);
    expect(JSON.stringify(config.navigation)).toBe(JSON.stringify(baseline.navigation));
  });
});

describe('docs visual: chat mockup', () => {
  test('no text is drawn in the teal that fails AA on white', () => {
    expect(readRepositoryFile(CHAT_SNIPPET_FILE)).not.toMatch(TEAL_TEXT_PATTERN);
  });

  test('white text on the header passes AA', () => {
    expect(contrastOf({ foreground: WHITE, background: chatColourOf({ name: 'header' }) })).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  });

  test.each([WHITE, SENT_BUBBLE, NOTICE_BUBBLE])('the sender ink passes AA on %s', (background) => {
    expect(contrastOf({ foreground: chatColourOf({ name: 'senderInk' }), background })).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  });

  test.each([WHITE, SENT_BUBBLE])('the muted ink passes AA on %s', (background) => {
    expect(contrastOf({ foreground: chatColourOf({ name: 'mutedInk' }), background })).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  });

  test('the component takes a frame and renders a typing bubble hidden from assistive technology', () => {
    const source = readRepositoryFile(CHAT_SNIPPET_FILE);
    expect(source).toMatch(CHAT_PROPS_PATTERN);
    expect(source).toMatch(TYPING_MESSAGE_PATTERN);
    expect(source).toContain(TYPING_CLASS);
    expect(source).toMatch(TYPING_HIDDEN_PATTERN);
  });
});

describe('docs visual: stylesheet', () => {
  test.each(HERO_CLASSES)('it defines .%s', (className) => {
    expect(readRepositoryFile(STYLESHEET_FILE)).toContain(`.${className}`);
  });

  test('keyframes live only inside the no-preference motion query', () => {
    const stylesheet = readRepositoryFile(STYLESHEET_FILE);
    expect(stylesheet).toMatch(MOTION_BLOCK_PATTERN);
    expect(stylesheet.replace(MOTION_BLOCK_PATTERN, '')).not.toMatch(KEYFRAMES_PATTERN);
  });

  test('it imports nothing and loads nothing from another origin', () => {
    const stylesheet = readRepositoryFile(STYLESHEET_FILE);
    expect(stylesheet).not.toMatch(IMPORT_RULE_PATTERN);
    expect(stylesheet).not.toMatch(FOREIGN_URL_PATTERN);
  });

  test('it has a forced-colors block', () => {
    expect(readRepositoryFile(STYLESHEET_FILE)).toMatch(FORCED_COLORS_PATTERN);
  });

  const heroPointsOf = ({ prefix }: { prefix: string }): string[] =>
    prefix
      ? [DARK_HERO_BASE, compositeOver({ colour: DARK_GLOW, backdrop: DARK_HERO_BASE })]
      : [LIGHT_HERO_START, LIGHT_HERO_END, compositeOver({ colour: LIGHT_GLOW, backdrop: LIGHT_HERO_START })];

  test.each(['', DARK_PREFIX])('hero text passes AA on every point of the hero gradient (prefix "%s")', (prefix) => {
    const textSelectors = ['.zapbip-hero-statement', '.zapbip-hero-accent', '.zapbip-hero-lead'];
    const failing = textSelectors.flatMap((selector) =>
      heroPointsOf({ prefix })
        .map((background) => ({
          selector,
          background,
          ratio: contrastOf({ foreground: declarationOf({ selector: `${prefix}${selector}`, property: 'color' }), background }),
        }))
        .filter((pair) => pair.ratio < BODY_TEXT_CONTRAST),
    );
    expect(failing).toEqual([]);
  });

  test.each(['', DARK_PREFIX])('eyebrow and both buttons pass AA (prefix "%s")', (prefix) => {
    const filled = ['.zapbip-hero-eyebrow', '.zapbip-button-primary', '.zapbip-button-secondary'];
    const failing = filled
      .map((selector) => ({
        selector,
        ratio: contrastOf({
          foreground: declarationOf({ selector: `${prefix}${selector}`, property: 'color' }),
          background: declarationOf({ selector: `${prefix}${selector}`, property: 'background-color' }),
        }),
      }))
      .filter((pair) => pair.ratio < BODY_TEXT_CONTRAST);
    expect(failing).toEqual([]);
  });
});
