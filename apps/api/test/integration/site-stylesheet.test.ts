import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SITE_STYLESHEET } from '../../src/site/site-stylesheet';
import { applyLandingWaitlistMigration } from '../support/seed';
import { joinForm, refusingTurnstile, siteEnvironment, siteFetch } from '../support/site';

const RAW_COLOUR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const CLASS_ATTRIBUTE_PATTERN = /class="([^"$]+)"/g;
const SELECTOR_CLASS_PATTERN = /\.([a-z][a-z0-9-]*)/g;
const REDUCED_MOTION_PATTERN = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation: none !important[\s\S]*?\n\}/;
const FORCED_COLORS_PATTERN = /@media \(forced-colors: active\)/;
const DARK_BLOCK_PATTERN = /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\)\s*\{[^}]*\}/;
const FORCED_DARK_BLOCK_PATTERN = /:root\[data-theme='dark'\]\s*\{[^}]*\}/;
const BASE_BLOCK_PATTERN = /^:root\s*\{[^}]*\}/m;
const BLOCK_BODY_PATTERN = /:root[^{]*\{([^}]*)\}/;
const WHITESPACE_PATTERN = /\s+/g;
const THIRD_PARTY_CLASSES = ['cf-turnstile'];

function declaredClasses(): Set<string> {
  return new Set([...SITE_STYLESHEET.matchAll(SELECTOR_CLASS_PATTERN)].map((match) => match[1]!));
}

function usedClasses(input: { html: string }): string[] {
  return [...input.html.matchAll(CLASS_ATTRIBUTE_PATTERN)].flatMap((match) => match[1]!.split(' ')).filter((name) => name.length > 0);
}

function withoutTokenBlocks(input: { css: string }): string {
  return input.css.replace(BASE_BLOCK_PATTERN, '').replace(DARK_BLOCK_PATTERN, '').replace(FORCED_DARK_BLOCK_PATTERN, '');
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the site stylesheet', () => {
  it('names every colour only inside its token blocks', () => {
    expect(withoutTokenBlocks({ css: SITE_STYLESHEET })).not.toMatch(RAW_COLOUR_PATTERN);
  });

  it('keeps the forced dark block the same palette as the system dark block', () => {
    const systemDark = SITE_STYLESHEET.match(DARK_BLOCK_PATTERN);
    const forcedDark = SITE_STYLESHEET.match(FORCED_DARK_BLOCK_PATTERN);
    if (systemDark === null || forcedDark === null) throw new Error('the stylesheet needs both dark token blocks');
    const bodyOf = (block: string): string => block.match(BLOCK_BODY_PATTERN)![1]!.replace(WHITESPACE_PATTERN, ' ').trim();
    expect(bodyOf(forcedDark[0])).toBe(bodyOf(systemDark[0]));
  });

  it('sets the native colour scheme in each block', () => {
    expect(SITE_STYLESHEET.match(BASE_BLOCK_PATTERN)?.[0]).toContain('color-scheme: light;');
    expect(SITE_STYLESHEET.match(DARK_BLOCK_PATTERN)?.[0]).toContain('color-scheme: dark;');
    expect(SITE_STYLESHEET.match(FORCED_DARK_BLOCK_PATTERN)?.[0]).toContain('color-scheme: dark;');
  });

  it('turns every animation and transition off under reduced motion', () => {
    expect(SITE_STYLESHEET).toMatch(REDUCED_MOTION_PATTERN);
    expect(SITE_STYLESHEET).toContain('transition: none !important');
  });

  it('keeps the reveals behind the no-preference query and away from scroll timelines', () => {
    expect(SITE_STYLESHEET).not.toContain('@supports (animation-timeline: view())');
    expect(SITE_STYLESHEET).toContain('@media (prefers-reduced-motion: no-preference)');
  });

  it('paints the privacy band from band colours that follow the theme, not from the always-dark terminal', () => {
    const band = /\n\.band \{[^}]*\}/.exec(SITE_STYLESHEET)![0];
    expect(band).toContain('var(--color-band)');
    expect(band).not.toContain('var(--color-terminal)');
    expect(SITE_STYLESHEET).toMatch(/:root \{[^}]*--color-band: #eef3ef;/);
    expect(SITE_STYLESHEET).toMatch(/:root\[data-theme='dark'\] \{[^}]*--color-band: #050d0b;/);
  });

  it('adapts to forced colours', () => {
    expect(SITE_STYLESHEET).toMatch(FORCED_COLORS_PATTERN);
  });

  it('styles every class the page renders in every state', async () => {
    const pages = await Promise.all([
      siteFetch({ path: '/' }),
      siteFetch({ path: '/?ref=abcdefgh2345' }),
      siteFetch({ path: '/', env: siteEnvironment({ overrides: { TURNSTILE_SECRET_KEY: '' } }) }),
      siteFetch({ path: '/nope' }),
      siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: 'maria@example.com' }) }),
      siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: 'not-an-email' }) }),
      siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: 'maria@example.com' }), recording: refusingTurnstile() }),
    ]);
    const used = (await Promise.all(pages.map((page) => page.text()))).flatMap((html) => usedClasses({ html }));
    const declared = declaredClasses();
    expect([...new Set(used)].filter((name) => !declared.has(name) && !THIRD_PARTY_CLASSES.includes(name))).toEqual([]);
  });
});
