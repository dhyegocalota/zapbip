import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import type { AgentDefinition, AgentInstall } from '../contract';
import { violationIf } from './registry';

export type InstallSectionEntry = { id: string; install: AgentInstall; definition: AgentDefinition };

const MINIMUM_STEP_COUNT = 2;
const CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
const SECRET_FRAGMENT = 'zb_conn_FAKE';
const STANDBY_AGENT_OPTIONS: (string | null)[] = [null, 'Ana Bot'];
const STOP_CHECK_PATTERN = /^1\. If you are not .+, stop and run no other step of this section\. Success: .+$/m;
const STEP_NUMBER_PATTERN = /^\d+\. /m;
const SUCCESS_LINE_PATTERN = /Success: \S/;
const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;
const PACKAGE_VERSION_PATTERN = /zapbip@(\S+)/g;

type SectionCase = { entry: InstallSectionEntry; locale: OwnerLocale; standbyAgent: string | null };

function lastNonEmptyLine(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .at(-1) as string;
}

function matchesOf(input: { text: string; pattern: RegExp }): string[] {
  return [...input.text.matchAll(input.pattern)].map((match) => match[1] as string);
}

function caseViolationsOf(input: { sectionCase: SectionCase }): string[] {
  const { entry, locale, standbyAgent } = input.sectionCase;
  const { id, install, definition } = entry;
  const section = { connectionLink: CONNECTION_LINK, locale, standbyAgent };
  const text = install.render(section);
  const label = `${id} in ${locale}`;
  const steps = text.split(STEP_NUMBER_PATTERN).slice(1);
  const unlistedModes = [...new Set(matchesOf({ text, pattern: SET_WAKE_MODE_PATTERN }))].filter(
    (mode) => !definition.listen.setWakeModes.some((allowed) => allowed === mode),
  );
  const hasSecretOutsideLink = !text.includes(CONNECTION_LINK) || text.replaceAll(CONNECTION_LINK, '').includes(SECRET_FRAGMENT);
  return [
    ...violationIf({
      condition: !text.startsWith(`## ${install.productName}\n`),
      message: `${label}: the section must open with the heading ## ${install.productName}`,
    }),
    ...violationIf({ condition: !STOP_CHECK_PATTERN.test(text), message: `${label}: step 1 must be the stop check` }),
    ...violationIf({
      condition: !lastNonEmptyLine(text).includes(INSTALL_SELF_TEST_TEXT[locale]),
      message: `${label}: the last line must be the self-test`,
    }),
    ...violationIf({
      condition: steps.length < MINIMUM_STEP_COUNT || steps.some((step) => !SUCCESS_LINE_PATTERN.test(step)),
      message: `${label}: every step must state its success`,
    }),
    ...violationIf({
      condition: unlistedModes.length > 0,
      message: `${label}: set_wake modes ${unlistedModes.join(', ')} are not in its definition`,
    }),
    ...violationIf({
      condition: hasSecretOutsideLink,
      message: `${label}: the connection secret must appear only inside the connection link`,
    }),
    ...violationIf({ condition: install.render(section) !== text, message: `${label}: rendering twice must give the same text` }),
    ...violationIf({
      condition: matchesOf({ text, pattern: PACKAGE_VERSION_PATTERN }).some((version) => version !== ZAPBIP_NPM_VERSION),
      message: `${label}: the package version must come from ZAPBIP_NPM_VERSION`,
    }),
  ];
}

export function installSectionViolationsOf(input: { entries: InstallSectionEntry[] }): string[] {
  const violations = input.entries.flatMap((entry) =>
    Object.values(OwnerLocale).flatMap((locale) =>
      STANDBY_AGENT_OPTIONS.flatMap((standbyAgent) => caseViolationsOf({ sectionCase: { entry, locale, standbyAgent } })),
    ),
  );
  return [...new Set(violations)];
}
