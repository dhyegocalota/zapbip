import { DocsLanguage, INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import type { AgentPlugin } from '../contract';
import { violationIf } from './registry';

export type PageRuleInput = { label: string; language: DocsLanguage; page: string; hasInstall: boolean; plugin: AgentPlugin | null };

const FRONT_MATTER_PATTERN = /^---\ntitle: .+\ndescription: .+\n---\n/;
const UNPINNED_PACKAGE_PATTERN = /npx zapbip(?!@)/;
const TEST_DOUBLE_PATTERN = /fake|simulator|localhost|zb_conn_/i;
const CONNECTION_LINK_PLACEHOLDER = '<connectionLink>';
const CODE_PATTERN = /```[\s\S]*?```|`[^`\n]*`/g;
const CHAT_IMPORT = "import { Chat } from '/snippets/chat.jsx';";
const CHAT_TAG = '<Chat';
const NON_PORTABLE_HASH_TOOL = 'sha256sum';
const OWNER_LOCALES: Record<DocsLanguage, OwnerLocale> = {
  [DocsLanguage.English]: OwnerLocale.EnglishUs,
  [DocsLanguage.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
};
const NEW_AGENT_WORDS: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'new agent',
  [DocsLanguage.PortugueseBrazil]: 'novo agente',
};
const ONE_LISTENER_SENTENCES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: `Run only one listener per agent: the plugin or \`npx zapbip@${ZAPBIP_NPM_VERSION} listen\`, never both. A second listener replaces the first.`,
  [DocsLanguage.PortugueseBrazil]: `Rode apenas um listener por agente: o plugin ou \`npx zapbip@${ZAPBIP_NPM_VERSION} listen\`, nunca os dois. Um segundo listener substitui o primeiro.`,
};

function stepGuideViolationsOf(input: PageRuleInput): string[] {
  const hasPlaceholderInCode = input.page.includes(CONNECTION_LINK_PLACEHOLDER);
  const hasPlaceholderOutsideCode = input.page.replace(CODE_PATTERN, '').includes(CONNECTION_LINK_PLACEHOLDER);
  return [
    ...violationIf({
      condition: !input.page.includes(NEW_AGENT_WORDS[input.language]),
      message: `${input.label}: the step guide must start from the number and ask for a new agent`,
    }),
    ...violationIf({
      condition: !hasPlaceholderInCode || hasPlaceholderOutsideCode,
      message: `${input.label}: the connection link must appear as ${CONNECTION_LINK_PLACEHOLDER} inside code`,
    }),
  ];
}

function pluginViolationsOf(input: PageRuleInput & { plugin: AgentPlugin }): string[] {
  return [
    ...violationIf({
      condition: !input.page.includes(input.plugin.installCommand),
      message: `${input.label}: the page must print the plugin install command`,
    }),
    ...violationIf({
      condition: input.page.includes(`${input.plugin.packageName}==`),
      message: `${input.label}: the plugin package must not be installed unpinned`,
    }),
    ...violationIf({
      condition: input.page.includes(NON_PORTABLE_HASH_TOOL),
      message: `${input.label}: the page must not use ${NON_PORTABLE_HASH_TOOL}`,
    }),
    ...violationIf({
      condition: !input.page.includes(INSTALL_SELF_TEST_TEXT[OWNER_LOCALES[input.language]]),
      message: `${input.label}: the page must ask the agent to send the self-test text`,
    }),
    ...violationIf({
      condition: !input.page.includes(ONE_LISTENER_SENTENCES[input.language]),
      message: `${input.label}: the page must tell the owner to run only one listener`,
    }),
  ];
}

export function pageRuleViolationsOf(input: PageRuleInput): string[] {
  const generalViolations = [
    ...violationIf({
      condition: !FRONT_MATTER_PATTERN.test(input.page),
      message: `${input.label}: the page needs a title and a description in its front matter`,
    }),
    ...violationIf({
      condition: !input.page.includes(CHAT_IMPORT) || !input.page.includes(CHAT_TAG),
      message: `${input.label}: the page must show at least one conversation`,
    }),
    ...violationIf({
      condition: UNPINNED_PACKAGE_PATTERN.test(input.page),
      message: `${input.label}: npx zapbip must name the pinned version`,
    }),
    ...violationIf({
      condition: input.hasInstall && TEST_DOUBLE_PATTERN.test(input.page),
      message: `${input.label}: the page names a test double`,
    }),
  ];
  if (input.plugin) return [...generalViolations, ...pluginViolationsOf({ ...input, plugin: input.plugin })];
  if (input.hasInstall) return [...generalViolations, ...stepGuideViolationsOf(input)];
  return generalViolations;
}
