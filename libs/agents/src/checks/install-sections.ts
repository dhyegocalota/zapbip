import { marked } from 'marked';
import { INSTALL_PRODUCT_TEXT_MAX_LENGTH, INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
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
const LINE_BREAK_PATTERN = /[\r\n\v\f\u0085\u2028\u2029]/;
const FORMAT_CHARACTER_PATTERN = /[\p{Cf}\u2028\u2029]/u;
const FORMAT_CHARACTER_GLOBAL_PATTERN = /\p{Cf}/gu;
const UNSPACED_HEADING_MARKER_PATTERN = /^ {0,3}#{1,6}[^\s#]/m;
const WHITESPACE_RUN_PATTERN = /\s+/g;
const SENTINEL_HEADING = '\n\n## Sentinel\n';
const EXPECTED_HEADING_COUNT = 2;
const MAXIMUM_HEADING_DEPTH = 2;
const PROSE_TOKEN_TYPES = ['paragraph', 'text'];
const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;
const PACKAGE_VERSION_PATTERN = /zapbip@(\S+)/g;

type SectionCase = { entry: InstallSectionEntry; locale: OwnerLocale; standbyAgent: string | null };

function lastNonEmptyLine(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .at(-1) as string;
}

function matchesOf({ text, pattern, group = 1 }: { text: string; pattern: RegExp; group?: number }): string[] {
  return [...text.matchAll(pattern)].map((match) => match[group] as string);
}

function holdsOneHeadingOnly(input: { text: string }): boolean {
  let headingCount = 0;
  let refusedCount = 0;
  marked.walkTokens(marked.lexer(`${input.text}${SENTINEL_HEADING}`), (token) => {
    if (token.type === 'heading' && token.depth <= MAXIMUM_HEADING_DEPTH) headingCount += 1;
    const isHtml = token.type === 'html';
    const isUnspacedMarker = PROSE_TOKEN_TYPES.includes(token.type) && UNSPACED_HEADING_MARKER_PATTERN.test(token.raw);
    if (isHtml || isUnspacedMarker) refusedCount += 1;
  });
  return headingCount === EXPECTED_HEADING_COUNT && refusedCount === 0;
}

function comparableNameOf(input: { name: string }): string {
  return input.name
    .normalize('NFKC')
    .replace(FORMAT_CHARACTER_GLOBAL_PATTERN, '')
    .toLowerCase()
    .replace(WHITESPACE_RUN_PATTERN, ' ')
    .trim();
}

function duplicateNameViolationsOf(input: { entry: InstallSectionEntry; entries: InstallSectionEntry[] }): string[] {
  const comparableName = comparableNameOf({ name: input.entry.install.productName });
  const [first] = input.entries.filter((other) => comparableNameOf({ name: other.install.productName }) === comparableName);
  if (first === undefined || first.id === input.entry.id) return [];
  return [`${input.entry.id}: the product name ${input.entry.install.productName} is also used by ${first.id}`];
}

function productTextViolationsOf(input: { entry: InstallSectionEntry }): string[] {
  const { id, install } = input.entry;
  const fields = [
    { label: 'product name', value: install.productName },
    { label: 'product description', value: install.productDescription },
  ];
  return fields.flatMap((field) => [
    ...violationIf({
      condition: LINE_BREAK_PATTERN.test(field.value) || field.value.length > INSTALL_PRODUCT_TEXT_MAX_LENGTH,
      message: `${id}: the ${field.label} must be one line of at most ${INSTALL_PRODUCT_TEXT_MAX_LENGTH} characters`,
    }),
    ...violationIf({
      condition: FORMAT_CHARACTER_PATTERN.test(field.value),
      message: `${id}: the ${field.label} must not hold format characters`,
    }),
  ]);
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
    ...violationIf({
      condition: !holdsOneHeadingOnly({ text }),
      message: `${label}: the section must hold exactly one heading`,
    }),
    ...violationIf({
      condition: FORMAT_CHARACTER_PATTERN.test(text),
      message: `${label}: the section must not hold format characters`,
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
  const productViolations = input.entries.flatMap((entry) => [
    ...productTextViolationsOf({ entry }),
    ...duplicateNameViolationsOf({ entry, entries: input.entries }),
  ]);
  return [...new Set([...productViolations, ...violations])];
}
