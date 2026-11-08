import { DocsLanguage, INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
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
  '## Set up from zero',
  '',
  '1. Ask for a new agent and paste `<connectionLink>`.',
  '',
].join('\n');
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
  INSTALL_COMMAND,
  INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs],
  `Run only one listener per agent: the plugin or \`npx zapbip@${ZAPBIP_NPM_VERSION} listen\`, never both. A second listener replaces the first.`,
  '',
].join('\n');

function guideInput(input: Partial<PageRuleInput>): PageRuleInput {
  return { label: LABEL, language: DocsLanguage.English, page: GUIDE_PAGE, hasInstall: true, plugin: null, ...input };
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
    expect(pageRuleViolationsOf(guideInput({ page, language: DocsLanguage.PortugueseBrazil }))).toEqual([]);
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
