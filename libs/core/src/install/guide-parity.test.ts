import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InstallClient, INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INSTALL_SECTIONS } from './prompts/index';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const CONNECTION_LINK_PLACEHOLDER = '<connectionLink>';
const STANDBY_AGENT = 'standby';
const SECTION_SPLIT_PATTERN = /^## .+$/m;
const SET_UP_SECTION_INDEX = 3;
const STEP_START_PATTERN = /\n\d+\. /g;
const ACTION_PATTERN =
  /claude mcp remove|claude mcp add|gemini mcp add|npx zapbip(?:@\S+)? (?:connect|listen|channel)|set_wake|claude -p|codex exec|gemini -p|check_inbox|send_message/g;
const WAKE_MODE_PATTERN = /mode: "(\w+)"/g;
const VERSION_PATTERN = /@\S+/;

const PLUGIN_PAGE_CLIENTS: InstallClient[] = [InstallClient.Hermes, InstallClient.OpenClaw];
const STEP_GUIDE_CLIENTS = Object.values(InstallClient).filter((client) => !PLUGIN_PAGE_CLIENTS.includes(client));

type GuideLanguage = { locale: OwnerLocale; pagePrefix: string };

const GUIDE_LANGUAGES: GuideLanguage[] = [
  { locale: OwnerLocale.EnglishUs, pagePrefix: 'agents' },
  { locale: OwnerLocale.PortugueseBrazil, pagePrefix: 'pt-br/agents' },
];

function readGuide({ pagePrefix, client }: { pagePrefix: string; client: InstallClient }): string {
  return readFileSync(`${REPOSITORY_ROOT}apps/docs/${pagePrefix}/${client}.mdx`, 'utf8');
}

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function actionsOf(text: string): string[] {
  return uniqueInOrder([...text.matchAll(ACTION_PATTERN)].map((match) => match[0].replace(VERSION_PATTERN, '')));
}

function wakeModesOf(text: string): string[] {
  return uniqueInOrder([...text.matchAll(WAKE_MODE_PATTERN)].flatMap((match) => match.slice(1, 2)));
}

function sectionText({ client, standbyAgent }: { client: InstallClient; standbyAgent: string | null }): string {
  return INSTALL_SECTIONS[client]({ connectionLink: CONNECTION_LINK_PLACEHOLDER, locale: OwnerLocale.EnglishUs, standbyAgent });
}

function setUpOf(guide: string): string {
  const setUp = guide.split(SECTION_SPLIT_PATTERN)[SET_UP_SECTION_INDEX];
  if (setUp === undefined) throw new Error('guide has no set up section');
  return setUp;
}

describe('install guide parity', () => {
  test.each(STEP_GUIDE_CLIENTS)('IS-D2 the %s guide mirrors its section: same actions in order, same wake modes', (client) => {
    const guide = setUpOf(readGuide({ pagePrefix: GUIDE_LANGUAGES[0]!.pagePrefix, client }));
    const withStandby = sectionText({ client, standbyAgent: STANDBY_AGENT });
    const withoutStandby = sectionText({ client, standbyAgent: null });
    expect(actionsOf(guide)).toEqual(actionsOf(withStandby));
    expect(wakeModesOf(guide)).toEqual(uniqueInOrder([...wakeModesOf(withStandby), ...wakeModesOf(withoutStandby)]));
  });

  test.each(GUIDE_LANGUAGES.flatMap((language) => Object.values(InstallClient).map((client) => ({ ...language, client }))))(
    'IS-D2 the $locale twin of $client has the same actions and wake modes as the English guide',
    ({ pagePrefix, client }) => {
      const english = setUpOf(readGuide({ pagePrefix: GUIDE_LANGUAGES[0]!.pagePrefix, client }));
      const twin = setUpOf(readGuide({ pagePrefix, client }));
      expect(actionsOf(twin)).toEqual(actionsOf(english));
      expect(wakeModesOf(twin)).toEqual(wakeModesOf(english));
    },
  );

  test.each(GUIDE_LANGUAGES.flatMap((language) => PLUGIN_PAGE_CLIENTS.map((client) => ({ ...language, client }))))(
    'IS-D3 the $locale plugin page for $client asks for its own locale self-test only',
    ({ locale, pagePrefix, client }) => {
      const guide = readGuide({ pagePrefix, client });
      const otherSelfTests = Object.values(OwnerLocale)
        .filter((other) => other !== locale)
        .map((other) => INSTALL_SELF_TEST_TEXT[other]);
      expect(guide).toContain(INSTALL_SELF_TEST_TEXT[locale]);
      otherSelfTests.forEach((otherSelfTest) => expect(guide).not.toContain(otherSelfTest));
    },
  );

  test.each(GUIDE_LANGUAGES.flatMap((language) => STEP_GUIDE_CLIENTS.map((client) => ({ ...language, client }))))(
    'IS-D3 the $locale guide for $client ends with the self-test',
    ({ locale, pagePrefix, client }) => {
      const setUp = setUpOf(readGuide({ pagePrefix, client }));
      const lastStep = setUp.slice([...setUp.matchAll(STEP_START_PATTERN)].at(-1)!.index);
      expect(lastStep).toContain('send_message');
      expect(lastStep).toContain(INSTALL_SELF_TEST_TEXT[locale]);
    },
  );
});
