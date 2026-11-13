import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { SiteCopyKey } from '../../src/site/site-copy';
import { copyHtml, REFERRAL_CODE, siteFetch } from '../support/site';

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
    expect(summary[1]).toBe(copyHtml({ key: SiteCopyKey.LocaleLabel, locale }));
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
    expect(options.map((option) => option[1])).toEqual([OwnerLocale.EnglishUs, OwnerLocale.PortugueseBrazil]);
    expect(options[0]![3]).toContain('data-flag="us"');
    expect(options[0]![3]).toContain(copyHtml({ key: SiteCopyKey.LocaleEnglish, locale: current }));
    expect(options[1]![3]).toContain('data-flag="br"');
    expect(options[1]![3]).toContain(copyHtml({ key: SiteCopyKey.LocalePortuguese, locale: current }));
    const markedValues = options.filter((option) => option[2]!.includes('aria-current="true"')).map((option) => option[1]);
    expect(markedValues).toEqual([current]);
  });

  it('keeps the agent and the referral code in the form that changes the language', async () => {
    const menu = await menuOf({ path: `/pt-br?agent=codex&ref=${REFERRAL_CODE}` });
    expect(menu).toContain('action="/locale"');
    expect(menu).toContain(`name="returnTo" value="/pt-br?agent=codex&amp;ref=${REFERRAL_CODE}"`);
  });

  it('draws the flags inline, with no outside image', async () => {
    const html = await (await siteFetch({ path: '/' })).text();
    const menu = MENU_PATTERN.exec(html)![1]!;
    expect(menu).toContain('<svg class="flag" data-flag="us"');
    expect(menu).not.toMatch(/<img|https?:/);
  });

  it('replaces the two text buttons with the single menu', async () => {
    const html = await (await siteFetch({ path: '/' })).text();
    expect(html.match(/<button type="submit" name="locale"/g)).toHaveLength(2);
    expect(html).not.toContain('label-short');
    expect(html).not.toContain('label-full');
  });
});
