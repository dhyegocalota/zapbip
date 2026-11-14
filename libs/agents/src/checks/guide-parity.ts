import { DOCS_OWNER_LOCALES, DocsPageLanguage, INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import type { AgentInstall } from '../contract';
import { AGENT_PAGE_HEADINGS, AgentPageSection } from '../docs';
import { violationIf } from './registry';

export type GuideParityEntry = {
  id: string;
  install: AgentInstall;
  isPluginPage: boolean;
  guides: Record<DocsPageLanguage, string>;
};

const CONNECTION_LINK_PLACEHOLDER = '<connectionLink>';
const STANDBY_AGENT = 'standby';
const HEADING_PATTERN = /^## .+$/m;
const STEP_START_PATTERN = /\n\d+\. /g;
const ACTION_PATTERN =
  /claude mcp remove|[a-z]+ mcp add|npx zapbip(?:@\S+)? (?:connect|listen|channel)|set_wake|[a-z]+ (?:exec|-p)(?![\w-])|check_inbox|send_message/g;
const WAKE_MODE_PATTERN = /mode: "(\w+)"/g;
const VERSION_PATTERN = /@\S+/;
const SELF_TEST_COMMAND_PATTERN = /`((?:[a-z]+ -p "Call|[a-z]+ exec -c|[a-z]+ -p)[^`]*)`/;
const SELF_TEST_ACTION = 'send_message';

const LANGUAGE_LABEL: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'English',
  [DocsPageLanguage.PortugueseBrazil]: 'Portuguese',
  [DocsPageLanguage.Spanish]: 'Spanish',
  [DocsPageLanguage.German]: 'German',
  [DocsPageLanguage.French]: 'French',
  [DocsPageLanguage.Japanese]: 'Japanese',
  [DocsPageLanguage.Korean]: 'Korean',
  [DocsPageLanguage.Chinese]: 'Chinese',
  [DocsPageLanguage.Arabic]: 'Arabic',
  [DocsPageLanguage.Hindi]: 'Hindi',
};

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function actionsOf(text: string): string[] {
  return uniqueInOrder([...text.matchAll(ACTION_PATTERN)].map((match) => match[0].replace(VERSION_PATTERN, '')));
}

function wakeModesOf(text: string): string[] {
  return uniqueInOrder([...text.matchAll(WAKE_MODE_PATTERN)].map((match) => match[1] as string));
}

function sectionTextOf(input: { install: AgentInstall; locale: OwnerLocale; standbyAgent: string | null }): string {
  return input.install.render({ connectionLink: CONNECTION_LINK_PLACEHOLDER, locale: input.locale, standbyAgent: input.standbyAgent });
}

function setUpOf(input: { guide: string; language: DocsPageLanguage }): string | null {
  const heading = `## ${AGENT_PAGE_HEADINGS[input.language][AgentPageSection.SetupFromZero]}`;
  const start = input.guide.indexOf(`\n${heading}\n`);
  if (start === -1) return null;
  return input.guide.slice(start + heading.length + 1).split(HEADING_PATTERN)[0] as string;
}

function lastStepOf(input: { setUp: string }): string {
  const lastStart = [...input.setUp.matchAll(STEP_START_PATTERN)].at(-1)?.index;
  if (lastStart === undefined) return '';
  return input.setUp.slice(lastStart);
}

function languageViolationsOf(input: { entry: GuideParityEntry; language: DocsPageLanguage; englishSetUp: string }): string[] {
  const { entry, language, englishSetUp } = input;
  const label = `${entry.id}: the ${LANGUAGE_LABEL[language]}`;
  const locale = DOCS_OWNER_LOCALES[language];
  const guide = entry.guides[language];
  const setUp = setUpOf({ guide, language });
  if (setUp === null) {
    const heading = AGENT_PAGE_HEADINGS[language][AgentPageSection.SetupFromZero];
    return [`${label} guide has no "${heading}" section`];
  }
  const isTwin = language !== DocsPageLanguage.English;
  const selfTestCommand = sectionTextOf({ install: entry.install, locale, standbyAgent: null }).match(SELF_TEST_COMMAND_PATTERN)?.[1];
  const otherSelfTests = Object.values(OwnerLocale)
    .filter((other) => other !== locale)
    .map((other) => INSTALL_SELF_TEST_TEXT[other]);
  const holdsOnlyOwnSelfTest = guide.includes(INSTALL_SELF_TEST_TEXT[locale]) && !otherSelfTests.some((text) => guide.includes(text));
  const lastStep = lastStepOf({ setUp });
  const endsWithSelfTest = lastStep.includes(SELF_TEST_ACTION) && lastStep.includes(INSTALL_SELF_TEST_TEXT[locale]);
  return [
    ...violationIf({
      condition:
        isTwin &&
        (actionsOf(setUp).join() !== actionsOf(englishSetUp).join() || wakeModesOf(setUp).join() !== wakeModesOf(englishSetUp).join()),
      message: `${label} guide must have the same actions and wake modes as the English guide`,
    }),
    ...violationIf({
      condition: entry.isPluginPage && !holdsOnlyOwnSelfTest,
      message: `${label} plugin page must ask for its own self-test only`,
    }),
    ...violationIf({
      condition: !entry.isPluginPage && !endsWithSelfTest,
      message: `${label} guide must end with the self-test`,
    }),
    ...violationIf({
      condition: !entry.isPluginPage && selfTestCommand !== undefined && !guide.includes(selfTestCommand),
      message: `${label} guide must run the self-test command of the install section`,
    }),
  ];
}

function englishSectionViolationsOf(input: { entry: GuideParityEntry; englishSetUp: string }): string[] {
  const { entry, englishSetUp } = input;
  const label = `${entry.id}: the ${LANGUAGE_LABEL[DocsPageLanguage.English]} guide must`;
  const withStandby = sectionTextOf({ install: entry.install, locale: OwnerLocale.EnglishUs, standbyAgent: STANDBY_AGENT });
  const withoutStandby = sectionTextOf({ install: entry.install, locale: OwnerLocale.EnglishUs, standbyAgent: null });
  const expectedModes = uniqueInOrder([...wakeModesOf(withStandby), ...wakeModesOf(withoutStandby)]);
  return [
    ...violationIf({
      condition: actionsOf(englishSetUp).join() !== actionsOf(withStandby).join(),
      message: `${label} name the same actions in the same order as the install section`,
    }),
    ...violationIf({
      condition: wakeModesOf(englishSetUp).join() !== expectedModes.join(),
      message: `${label} name the same wake modes as the install section`,
    }),
  ];
}

function entryViolationsOf(input: { entry: GuideParityEntry }): string[] {
  const { entry } = input;
  const englishSetUp = setUpOf({ guide: entry.guides[DocsPageLanguage.English], language: DocsPageLanguage.English });
  if (englishSetUp === null) {
    const heading = AGENT_PAGE_HEADINGS[DocsPageLanguage.English][AgentPageSection.SetupFromZero];
    return [`${entry.id}: the ${LANGUAGE_LABEL[DocsPageLanguage.English]} guide has no "${heading}" section`];
  }
  const englishSectionViolations = entry.isPluginPage ? [] : englishSectionViolationsOf({ entry, englishSetUp });
  const languageViolations = Object.values(DocsPageLanguage).flatMap((language) => languageViolationsOf({ entry, language, englishSetUp }));
  return [...englishSectionViolations, ...languageViolations];
}

export function guideParityViolationsOf(input: { entries: GuideParityEntry[] }): string[] {
  return input.entries.flatMap((entry) => entryViolationsOf({ entry }));
}
