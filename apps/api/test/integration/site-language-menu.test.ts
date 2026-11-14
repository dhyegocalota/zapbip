import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { LOCALE_PROFILES, MENU_LOCALES } from '../../src/web-shell/locale-profiles';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { REFERRAL_CODE, shellCopyHtml, siteFetch } from '../support/site';
import { AGENT_INSTALLS } from '@zapbip/agents/install';

const PICKED_AGENT = Object.keys(AGENT_INSTALLS)[0]!;

const MENU_PATTERN = /<details class="lang-menu">([\s\S]*?)<\/details>/;

async function menuOf(input: { path: string }): Promise<string> {
  const html = await (await siteFetch({ path: input.path })).text();
  return MENU_PATTERN.exec(html)![1]!;
}

describe('the language menu', () => {
  it.each([
    ['/', OwnerLocale.EnglishUs, 'data-flag="us"', 'EN'],
    ['/pt-br', OwnerLocale.PortugueseBrazil, 'data-flag="br"', 'PT'],
  ])('shows the current flag and code on the button of %s', async (path, locale, flag, code) => {
    const menu = await menuOf({ path });
    const summary = /<summary class="lang-trigger" aria-label="([^"]+)">([\s\S]*?)<\/summary>/.exec(menu)!;
    expect(summary[1]).toBe(`${shellCopyHtml({ key: ShellCopyKey.LocaleLabel, locale })}: ${code}`);
    expect(summary[2]).toContain(flag);
    expect(summary[2]).toContain(`>${code}<`);
  });

  it.each([
    ['/', OwnerLocale.EnglishUs],
    ['/pt-br', OwnerLocale.PortugueseBrazil],
  ])('lists both languages with a flag and the full name, the current one marked, on %s', async (path, current) => {
    const menu = await menuOf({ path });
    const options = [
      ...menu.matchAll(/<button type="submit" name="locale" value="([^"]+)" lang="[^"]+" class="lang-option"([^>]*)>([\s\S]*?)<\/button>/g),
    ];
    expect(options.map((option) => option[1])).toEqual(MENU_LOCALES);
    expect(options[0]![3]).toContain('data-flag="us"');
    expect(options[0]![3]).toContain(LOCALE_PROFILES[OwnerLocale.EnglishUs].nativeName);
    expect(options[1]![3]).toContain('data-flag="br"');
    expect(options[1]![3]).toContain(LOCALE_PROFILES[OwnerLocale.PortugueseBrazil].nativeName);
    const markedValues = options.filter((option) => option[2]!.includes('aria-current="true"')).map((option) => option[1]);
    expect(markedValues).toEqual([current]);
  });

  it('keeps the agent and the referral code in the form that changes the language', async () => {
    const menu = await menuOf({ path: `/pt-br?agent=${PICKED_AGENT}&ref=${REFERRAL_CODE}` });
    expect(menu).toContain('action="/locale"');
    expect(menu).toContain(`name="returnTo" value="/pt-br?agent=${PICKED_AGENT}&amp;ref=${REFERRAL_CODE}"`);
  });

  it('draws the flags inline, with no outside image', async () => {
    const html = await (await siteFetch({ path: '/' })).text();
    const menu = MENU_PATTERN.exec(html)![1]!;
    expect(menu).toContain('<svg class="flag" data-flag="us"');
    expect(menu).not.toMatch(/<img|https?:/);
  });

  it('replaces the two text buttons with the single menu', async () => {
    const html = await (await siteFetch({ path: '/' })).text();
    expect(html.match(/<button type="submit" name="locale"/g)).toHaveLength(MENU_LOCALES.length);
    expect(html).not.toContain('label-short');
    expect(html).not.toContain('label-full');
  });
});
