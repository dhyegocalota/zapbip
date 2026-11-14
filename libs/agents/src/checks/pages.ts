import { COMMAND_WORDS } from '@zapbip/core';
import { CommandKind, DOCS_OWNER_LOCALES, DocsPageLanguage, INSTALL_SELF_TEST_TEXT, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import type { AgentPlugin } from '../contract';
import { violationIf } from './registry';

export type PageRuleInput = { label: string; language: DocsPageLanguage; page: string; hasInstall: boolean; plugin: AgentPlugin | null };

const FRONT_MATTER_PATTERN = /^---\ntitle: .+\ndescription: .+\n---\n/;
const UNPINNED_PACKAGE_PATTERN = /npx zapbip(?!@)/;
const TEST_DOUBLE_PATTERN = /fake|simulator|localhost|zb_conn_/i;
const CONNECTION_LINK_PLACEHOLDER = '<connectionLink>';
const CODE_PATTERN = /```[\s\S]*?```|`[^`\n]*`/g;
const CHAT_IMPORT = "import { Chat } from '/snippets/chat.jsx';";
const CHAT_TAG = '<Chat';
const NON_PORTABLE_HASH_TOOL = 'sha256sum';
const LISTEN_COMMAND = `\`npx zapbip@${ZAPBIP_NPM_VERSION} listen\``;
const ONE_LISTENER_SENTENCES: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: `Run only one listener per agent: the plugin or ${LISTEN_COMMAND}, never both. A second listener replaces the first.`,
  [DocsPageLanguage.PortugueseBrazil]: `Rode apenas um listener por agente: o plugin ou ${LISTEN_COMMAND}, nunca os dois. Um segundo listener substitui o primeiro.`,
  [DocsPageLanguage.Spanish]: `Ejecuta un solo listener por agente: el plugin o ${LISTEN_COMMAND}, nunca los dos. Un segundo listener reemplaza al primero.`,
  [DocsPageLanguage.German]: `Führe pro Agent nur einen Listener aus: das Plugin oder ${LISTEN_COMMAND}, niemals beide. Ein zweiter Listener ersetzt den ersten.`,
  [DocsPageLanguage.French]: `Lancez un seul listener par agent\u00a0: le plugin ou ${LISTEN_COMMAND}, jamais les deux. Un second listener remplace le premier.`,
  [DocsPageLanguage.Japanese]: `エージェントごとにリスナーは 1 つだけ実行してください。プラグインか ${LISTEN_COMMAND} のどちらか一方で、両方は使わないでください。2 つ目のリスナーは 1 つ目を置き換えます。`,
  [DocsPageLanguage.Korean]: `에이전트마다 리스너는 하나만 실행하세요. 플러그인 또는 ${LISTEN_COMMAND} 중 하나만 쓰고, 둘 다 쓰지 마세요. 두 번째 리스너는 첫 번째를 대체합니다.`,
  [DocsPageLanguage.Chinese]: `每个智能体只运行一个 listener：插件或 ${LISTEN_COMMAND}，不要两者同时使用。第二个 listener 会替换第一个。`,
  [DocsPageLanguage.Arabic]: `شغّل مستمعًا واحدًا فقط لكل وكيل: المكوّن الإضافي أو ${LISTEN_COMMAND}، وليس الاثنين معًا. المستمع الثاني يحل محل الأول.`,
};

function newAgentWordsOf(input: { language: DocsPageLanguage }): string {
  const locale = DOCS_OWNER_LOCALES[input.language];
  return COMMAND_WORDS.find((entry) => entry.kind === CommandKind.CreateAgent && entry.locale === locale)!.words;
}

function stepGuideViolationsOf(input: PageRuleInput): string[] {
  const hasPlaceholderInCode = input.page.includes(CONNECTION_LINK_PLACEHOLDER);
  const hasPlaceholderOutsideCode = input.page.replace(CODE_PATTERN, '').includes(CONNECTION_LINK_PLACEHOLDER);
  return [
    ...violationIf({
      condition: !input.page.includes(newAgentWordsOf({ language: input.language })),
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
      condition: !input.page.includes(INSTALL_SELF_TEST_TEXT[DOCS_OWNER_LOCALES[input.language]]),
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
