import { COMMAND_WORDS } from '@zapbip/core';
import { CommandKind, DOCS_OWNER_LOCALES, DocsPageLanguage, INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { PluginRegistry, type AgentPlugin } from '../contract';
import { pageRuleViolationsOf, type PageRuleInput } from './pages';

const LABEL = 'demo page.en.mdx';
const INSTALL_COMMAND = 'demo plugins install demo-plugin@1.0.0';
const GUIDE_PAGE = [
  '---',
  'title: Demo',
  'description: Connect Demo.',
  '---',
  '',
  `import { Chat } from '/snippets/chat.jsx';`,
  '',
  '## Set up from zero',
  '',
  '1. Ask for a new agent and paste `<connectionLink>`.',
  '',
  `<Chat messages={[{ name: 'Demo', text: 'Hello from Demo', time: '14:03' }]} />`,
  '',
].join('\n');
const LISTENER_TAILS: Partial<Record<DocsPageLanguage, string>> = {
  [DocsPageLanguage.Spanish]: ', nunca los dos. Un segundo listener reemplaza al primero.',
  [DocsPageLanguage.German]: ', niemals beide. Ein zweiter Listener ersetzt den ersten.',
  [DocsPageLanguage.French]: ', jamais les deux. Un second listener remplace le premier.',
  [DocsPageLanguage.Japanese]: ' のどちらか一方で、両方は使わないでください。2 つ目のリスナーは 1 つ目を置き換えます。',
  [DocsPageLanguage.Korean]: ' 중 하나만 쓰고, 둘 다 쓰지 마세요. 두 번째 리스너는 첫 번째를 대체합니다.',
  [DocsPageLanguage.Chinese]: '，不要两者同时使用。第二个 listener 会替换第一个。',
  [DocsPageLanguage.Arabic]: '، وليس الاثنين معًا. المستمع الثاني يحل محل الأول.',
};
const PLUGIN: AgentPlugin = {
  packageFolder: 'apps/demo-plugin',
  packageName: 'demo-plugin',
  registry: PluginRegistry.Npm,
  version: '1.0.0',
  installCommand: INSTALL_COMMAND,
  hostedArtifacts: [],
  workflow: { name: 'demo', filter: 'demo', pythonRequirements: null },
  buildRequirements: null,
  versionPins: [],
  endToEndModule: 'demo',
};
const PLUGIN_PAGE = [
  '---',
  'title: Demo',
  'description: Connect Demo.',
  '---',
  '',
  `import { Chat } from '/snippets/chat.jsx';`,
  '',
  INSTALL_COMMAND,
  INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs],
  `Run only one listener per agent: the plugin or \`npx zapbip@${ZAPBIP_NPM_VERSION} listen\`, never both. A second listener replaces the first.`,
  '',
  `<Chat messages={[{ name: 'Demo', text: 'Hello from Demo', time: '14:03' }]} />`,
  '',
].join('\n');

function guideInput(input: Partial<PageRuleInput>): PageRuleInput {
  return { label: LABEL, language: DocsPageLanguage.English, page: GUIDE_PAGE, hasInstall: true, plugin: null, ...input };
}

function pluginInput(input: Partial<PageRuleInput>): PageRuleInput {
  return guideInput({ page: PLUGIN_PAGE, plugin: PLUGIN, ...input });
}

describe('pageRuleViolationsOf', () => {
  test('accepts a step guide and a plugin page', () => {
    expect(pageRuleViolationsOf(guideInput({}))).toEqual([]);
    expect(pageRuleViolationsOf(pluginInput({}))).toEqual([]);
  });

  test('rejects a page without front matter', () => {
    const page = GUIDE_PAGE.replace(/^---[\s\S]*?---\n/, '');
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([`${LABEL}: the page needs a title and a description in its front matter`]);
  });

  test.each([
    ['a step guide', guideInput, GUIDE_PAGE],
    ['a plugin page', pluginInput, PLUGIN_PAGE],
  ])('rejects %s without a conversation', (_name, inputOf, page) => {
    const withoutChat = page.replace(/^<Chat .*\/>$/m, '');
    expect(pageRuleViolationsOf(inputOf({ page: withoutChat }))).toEqual([`${LABEL}: the page must show at least one conversation`]);
  });

  test('rejects a conversation whose component is not imported', () => {
    const page = GUIDE_PAGE.replace(/^import .*$/m, '');
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([`${LABEL}: the page must show at least one conversation`]);
  });

  test('rejects an unpinned connector package', () => {
    const page = `${GUIDE_PAGE}\nRun \`npx zapbip listen\`.\n`;
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([`${LABEL}: npx zapbip must name the pinned version`]);
  });

  test.each(['fake', 'Simulator', 'localhost', 'zb_conn_abc'])('rejects the test double word %s on an install page', (word) => {
    const page = `${GUIDE_PAGE}\n${word}\n`;
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([`${LABEL}: the page names a test double`]);
  });

  test('allows those words on a page with no install facet', () => {
    const page = `${GUIDE_PAGE}\nlocalhost\n`;
    expect(pageRuleViolationsOf(guideInput({ page, hasInstall: false }))).toEqual([]);
  });

  test('rejects a step guide that never asks for a new agent', () => {
    const page = GUIDE_PAGE.replace('Ask for a new agent and paste', 'Paste');
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([
      `${LABEL}: the step guide must start from the number and ask for a new agent`,
    ]);
  });

  test('rejects a step guide with no connection link placeholder', () => {
    const page = GUIDE_PAGE.replace('<connectionLink>', 'the link');
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([
      `${LABEL}: the connection link must appear as <connectionLink> inside code`,
    ]);
  });

  test('rejects the placeholder outside code', () => {
    const page = `${GUIDE_PAGE}\nPaste <connectionLink> now.\n`;
    expect(pageRuleViolationsOf(guideInput({ page }))).toEqual([
      `${LABEL}: the connection link must appear as <connectionLink> inside code`,
    ]);
  });

  test('reads the Portuguese words for a Portuguese guide', () => {
    const page = GUIDE_PAGE.replace('Ask for a new agent', 'Peça um novo agente');
    expect(pageRuleViolationsOf(guideInput({ page, language: DocsPageLanguage.PortugueseBrazil }))).toEqual([]);
  });

  test.each(
    Object.values(DocsPageLanguage).filter(
      (language) => language !== DocsPageLanguage.English && language !== DocsPageLanguage.PortugueseBrazil,
    ),
  )('reads the command word and the self-test of the owner language of a %s guide and plugin page', (language) => {
    const locale = DOCS_OWNER_LOCALES[language];
    const words = COMMAND_WORDS.find((entry) => entry.kind === CommandKind.CreateAgent && entry.locale === locale)!.words;
    const guide = GUIDE_PAGE.replace('new agent', words);
    const plugin = PLUGIN_PAGE.replace(INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs], INSTALL_SELF_TEST_TEXT[locale]);
    expect(pageRuleViolationsOf(guideInput({ page: guide, language }))).toEqual([]);
    expect(pageRuleViolationsOf(pluginInput({ page: plugin, language }))).toEqual([
      `${LABEL}: the page must tell the owner to run only one listener`,
    ]);
  });

  test.each([
    [DocsPageLanguage.Spanish, 'Ejecuta un solo listener por agente: el plugin o'],
    [DocsPageLanguage.German, 'Führe pro Agent nur einen Listener aus: das Plugin oder'],
    [DocsPageLanguage.French, 'Lancez un seul listener par agent\u00a0: le plugin ou'],
    [DocsPageLanguage.Japanese, 'エージェントごとにリスナーは 1 つだけ実行してください。プラグインか'],
    [DocsPageLanguage.Korean, '에이전트마다 리스너는 하나만 실행하세요. 플러그인 또는'],
    [DocsPageLanguage.Chinese, '每个智能体只运行一个 listener：插件或'],
    [DocsPageLanguage.Arabic, 'شغّل مستمعًا واحدًا فقط لكل وكيل: المكوّن الإضافي أو'],
  ])('accepts the one-listener sentence of a %s plugin page', (language, sentenceStart) => {
    const page = PLUGIN_PAGE.replace(
      INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs],
      INSTALL_SELF_TEST_TEXT[DOCS_OWNER_LOCALES[language]],
    ).replace(
      /^Run only one listener.*$/m,
      `${sentenceStart} \`npx zapbip@${ZAPBIP_NPM_VERSION} listen\`${LISTENER_TAILS[language] as string}`,
    );
    expect(pageRuleViolationsOf(pluginInput({ page, language }))).toEqual([]);
  });

  test('rejects a plugin page that lacks the install command', () => {
    const page = PLUGIN_PAGE.replace(INSTALL_COMMAND, 'something else');
    expect(pageRuleViolationsOf(pluginInput({ page }))).toEqual([`${LABEL}: the page must print the plugin install command`]);
  });

  test('rejects a plugin page that installs the package unpinned', () => {
    const page = `${PLUGIN_PAGE}\npip install demo-plugin==\n`;
    expect(pageRuleViolationsOf(pluginInput({ page }))).toEqual([`${LABEL}: the plugin package must not be installed unpinned`]);
  });

  test('rejects a plugin page that uses a non-portable hash tool', () => {
    const page = `${PLUGIN_PAGE}\nsha256sum file\n`;
    expect(pageRuleViolationsOf(pluginInput({ page }))).toEqual([`${LABEL}: the page must not use sha256sum`]);
  });

  test('rejects a plugin page without the self-test text', () => {
    const page = PLUGIN_PAGE.replace(INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs], '');
    expect(pageRuleViolationsOf(pluginInput({ page }))).toEqual([`${LABEL}: the page must ask the agent to send the self-test text`]);
  });

  test('rejects a plugin page without the one-listener sentence', () => {
    const page = PLUGIN_PAGE.replace('Run only one listener per agent', 'Run any listeners');
    expect(pageRuleViolationsOf(pluginInput({ page }))).toEqual([`${LABEL}: the page must tell the owner to run only one listener`]);
  });
});
