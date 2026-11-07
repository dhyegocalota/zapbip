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
const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;
const RAW_COLOUR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const TOKEN_BLOCK_PATTERN = /:root\s*\{[^}]*\}/g;
const HEX_BASE = 16;
const LINEAR_THRESHOLD = 0.03928;

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

const CONTRAST_PAIRS: [string, string, number][] = [
  ['--color-text', '--color-page', TEXT_CONTRAST],
  ['--color-text', '--color-surface', TEXT_CONTRAST],
  ['--color-text-muted', '--color-page', TEXT_CONTRAST],
  ['--color-text-muted', '--color-surface', TEXT_CONTRAST],
  ['--color-action', '--color-surface', TEXT_CONTRAST],
  ['--color-action', '--color-page', TEXT_CONTRAST],
  ['--color-on-action', '--color-action', TEXT_CONTRAST],
  ['--color-danger', '--color-surface', TEXT_CONTRAST],
  ['--color-danger', '--color-danger-surface', TEXT_CONTRAST],
  ['--color-warning', '--color-warning-surface', TEXT_CONTRAST],
  ['--color-text', '--color-info-surface', TEXT_CONTRAST],
  ['--color-border-control', '--color-surface', NON_TEXT_CONTRAST],
  ['--color-brand', '--color-surface', NON_TEXT_CONTRAST],
  ['--color-focus', '--color-surface', NON_TEXT_CONTRAST],
];

function viewSources(input: { directory: string }): { path: string; source: string }[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return viewSources({ directory: path });
    return name.endsWith('.tsx') ? [{ path, source: readFileSync(path, 'utf8') }] : [];
  });
}

function tokensOf(input: { block: string }): Record<string, string> {
  return Object.fromEntries([...input.block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]));
}

function channelLuminance(input: { value: number }): number {
  const fraction = input.value / 255;
  return fraction <= LINEAR_THRESHOLD ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
}

function luminanceOf(input: { hex: string }): number {
  const [red, green, blue] = [1, 3, 5].map((offset) =>
    channelLuminance({ value: parseInt(input.hex.slice(offset, offset + 2), HEX_BASE) }),
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastOf(input: { foreground: string; background: string }): number {
  const [lighter, darker] = [luminanceOf({ hex: input.foreground }), luminanceOf({ hex: input.background })].sort(
    (left, right) => right - left,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

function themeTokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const blocks = STYLESHEET.match(TOKEN_BLOCK_PATTERN);
  if (blocks === null || blocks.length !== 2) throw new Error('the stylesheet needs a light and a dark token block');
  const light = tokensOf({ block: blocks[0]! });
  return { light, dark: { ...light, ...tokensOf({ block: blocks[1]! }) } };
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

  it.each(['light', 'dark'] as const)('meets the contrast of the design in %s', (theme) => {
    const tokens = themeTokens()[theme];
    const shortfalls = CONTRAST_PAIRS.filter(
      ([foreground, background, minimum]) => contrastOf({ foreground: tokens[foreground]!, background: tokens[background]! }) < minimum,
    ).map(([foreground, background]) => `${foreground} on ${background}`);
    expect(shortfalls).toEqual([]);
  });
});
