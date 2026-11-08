import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { AuditPage } from '../../src/backoffice/views/audit';
import { HomePage } from '../../src/backoffice/views/home';
import { SignInPage } from '../../src/backoffice/views/sign-in';
import { DeployEnvironment } from '../../src/contract/deploy-environment';

const BACKOFFICE_ROOT = join(import.meta.dirname, '../../src/backoffice');
const STYLESHEET = readFileSync(join(BACKOFFICE_ROOT, 'assets/backoffice.css'), 'utf8');
const RAW_COLOUR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const FORCED_COLORS_PATTERN = /@media \(forced-colors: active\)/;
const FORCED_COLORS_BLOCK_PATTERN = /@media \(forced-colors: active\) \{[\s\S]*?\n\}/;
const REDUCED_MOTION_GUARD_PATTERN =
  /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*animation: none !important;\s*transition: none !important;\s*\}\s*\}/;
const INFINITE_ANIMATION_PATTERN = /animation[a-z-]*:[^;]*\binfinite\b/;
const SMOOTH_SCROLL_PATTERN = /scroll-behavior:\s*smooth/;
const FORCED_COLOR_OPT_OUT_PATTERN = /forced-color-adjust:\s*none/;
const HERO_CARD_RULE_PATTERN = /\n\.hero-card \{[^}]*\}/;
const TOKEN_BLOCK_PATTERN = /:root\s*\{[^}]*\}/g;

const PAGE = {
  locale: OwnerLocale.EnglishUs,
  environment: DeployEnvironment.Production,
  stylesheetHref: '/assets/backoffice.css?v=1',
  csrfToken: 'token',
  notice: null,
};

const PAGES: Record<string, string> = {
  signIn: String(SignInPage({ ...PAGE, notice: BackofficeNotice.SignInFailed })),
  home: String(HomePage({ page: PAGE, counts: { pending: 1, active: 2, closed: 0, disabled: 0 } })),
  homeEmpty: String(HomePage({ page: PAGE, counts: { pending: 0, active: 0, closed: 0, disabled: 0 } })),
  audit: String(
    AuditPage({
      page: PAGE,
      rows: [
        {
          at: 0,
          action: BackofficeAuditAction.SignOut,
          target_kind: null,
          target_id: null,
          outcome: BackofficeAuditOutcome.Succeeded,
          client_address: null,
        },
      ],
    }),
  ),
};

function viewSources(input: { directory: string }): { path: string; source: string }[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return viewSources({ directory: path });
    return name.endsWith('.tsx') ? [{ path, source: readFileSync(path, 'utf8') }] : [];
  });
}

describe('design rules', () => {
  it('has no style attribute, style element or script element in any view', () => {
    const offenders = viewSources({ directory: BACKOFFICE_ROOT })
      .filter(({ source }) => /\sstyle=|<style|<script/.test(source))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it.each(Object.entries(PAGES))('renders %s with one h1 and the skip link first', (_name, html) => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    const firstFocusable = html.search(/<(a|button|input|select|textarea)\b/);
    expect(html.slice(firstFocusable)).toMatch(/^<a href="#content"/);
  });

  it.each(Object.entries(PAGES))('labels every visible input on %s', (_name, html) => {
    const inputIds = [...html.matchAll(/<input(?![^>]*type="hidden")[^>]*\sid="([^"]+)"/g)].map((match) => match[1]!);
    inputIds.forEach((id) => expect(html).toContain(`<label for="${id}"`));
  });

  it('holds no raw colour outside the token blocks', () => {
    expect(STYLESHEET.replace(TOKEN_BLOCK_PATTERN, '')).not.toMatch(RAW_COLOUR_PATTERN);
  });

  it('defines a token block for light and a second one for dark', () => {
    expect(STYLESHEET.match(TOKEN_BLOCK_PATTERN)).toHaveLength(2);
  });

  it('adapts to forced colors', () => {
    expect(STYLESHEET).toMatch(FORCED_COLORS_PATTERN);
  });

  it('turns every animation and transition off under reduced motion', () => {
    expect(STYLESHEET).toMatch(REDUCED_MOTION_GUARD_PATTERN);
  });

  it('never loops an animation or smooth-scrolls', () => {
    expect(STYLESHEET).not.toMatch(INFINITE_ANIMATION_PATTERN);
    expect(STYLESHEET).not.toMatch(SMOOTH_SCROLL_PATTERN);
  });

  it('draws the hero card border from the gradient token', () => {
    expect(STYLESHEET.match(HERO_CARD_RULE_PATTERN)?.[0]).toContain('var(--gradient-hero-border)');
  });

  it('gives the hero card system colours under forced colors', () => {
    const forcedColorsBlock = STYLESHEET.match(FORCED_COLORS_BLOCK_PATTERN)?.[0];
    expect(forcedColorsBlock).toMatch(/\.hero-card \{[^}]*border-color: CanvasText;[^}]*background: Canvas;/);
  });

  it('never opts out of forced colors', () => {
    expect(STYLESHEET).not.toMatch(FORCED_COLOR_OPT_OUT_PATTERN);
  });
});
