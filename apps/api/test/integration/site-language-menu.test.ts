import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { localePathOf } from '../../src/site/site-language';
import { LOCALE_PROFILES, MENU_LOCALES } from '../../src/web-shell/locale-profiles';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { REFERRAL_CODE, shellCopyHtml, siteFetch } from '../support/site';
import { AGENT_INSTALLS } from '@zapbip/agents/install';

const PICKED_AGENT = Object.keys(AGENT_INSTALLS)[0]!;

const EXPECTED_LANGUAGE_COUNT = 9;
const FLAGS_BY_LOCALE: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: 'us',
  [OwnerLocale.PortugueseBrazil]: 'br',
  [OwnerLocale.Spanish]: 'es',
  [OwnerLocale.German]: 'de',
  [OwnerLocale.French]: 'fr',
  [OwnerLocale.Japanese]: 'jp',
  [OwnerLocale.Korean]: 'kr',
  [OwnerLocale.ChineseSimplified]: 'cn',
  [OwnerLocale.Arabic]: 'arab',
};
const MENU_PATTERN = /<details class="lang-menu">([\s\S]*?)<\/details>/;

async function menuOf(input: { path: string }): Promise<string> {
  const html = await (await siteFetch({ path: input.path })).text();
  return MENU_PATTERN.exec(html)![1]!;
}

describe('the language menu', () => {
  it.each(MENU_LOCALES)('shows the current flag and code on the button of the %s page', async (locale) => {
    const menu = await menuOf({ path: localePathOf({ locale }) });
    const profile = LOCALE_PROFILES[locale];
    const summary = /<summary class="lang-trigger" aria-label="([^"]+)">([\s\S]*?)<\/summary>/.exec(menu)!;
    expect(summary[1]).toBe(`${shellCopyHtml({ key: ShellCopyKey.LocaleLabel, locale })}: ${profile.shortName}`);
    expect(summary[2]).toContain(`data-flag="${FLAGS_BY_LOCALE[locale]}"`);
    expect(summary[2]).toContain(`>${profile.shortName}<`);
  });

  it.each(MENU_LOCALES)(
    'lists the nine languages with a flag and the native name, the current one marked, on the %s page',
    async (current) => {
      const menu = await menuOf({ path: localePathOf({ locale: current }) });
      const options = [
        ...menu.matchAll(
          /<button type="submit" name="locale" value="([^"]+)" lang="([^"]+)" class="lang-option"([^>]*)>([\s\S]*?)<\/button>/g,
        ),
      ];
      expect(options.map((option) => option[1])).toEqual(MENU_LOCALES);
      expect(options).toHaveLength(EXPECTED_LANGUAGE_COUNT);
      options.forEach((option, index) => {
        const locale = MENU_LOCALES[index]!;
        expect(option[2]).toBe(LOCALE_PROFILES[locale].languageTag);
        expect(option[4]).toContain(`data-flag="${FLAGS_BY_LOCALE[locale]}"`);
        expect(option[4]).toContain(LOCALE_PROFILES[locale].nativeName);
      });
      const markedValues = options.filter((option) => option[3]!.includes('aria-current="true"')).map((option) => option[1]);
      expect(markedValues).toEqual([current]);
    },
  );

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

  it('replaces the text buttons with the single menu', async () => {
    const html = await (await siteFetch({ path: '/' })).text();
    expect(html.match(/<button type="submit" name="locale"/g)).toHaveLength(MENU_LOCALES.length);
    expect(html).not.toContain('label-short');
    expect(html).not.toContain('label-full');
  });
});
