import { DocsLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  GenerationMode,
  discoverAgents,
  treeBoundaryViolationsOf,
  treeLeakViolationsOf,
  listSource,
  planGeneratedFiles,
  readSource,
  writePlan,
  type GenerationPlan,
} from '@zapbip/agents/generate';
import { CONNECTOR_RUNTIMES } from '@zapbip/agents/connector';
import type { AgentConnectorRuntime } from '@zapbip/agents';
import { AGENT_DEFINITIONS } from '@zapbip/agents/definitions';
import { trackedFiles, readRepositoryFile } from './repository-files';

const SUPPORTED_ROOT = 'libs/agents/supported';
const TESTING_ROOT = 'libs/agents/testing';
const GENERATED_FOLDER = 'libs/agents/src/generated';
const DOCS_CONFIG = 'apps/docs/docs.json';
const WORKFLOW_FILE = '.github/workflows/verify.yml';
const REAL_AGENT_IDS = discoverAgents({ roots: [SUPPORTED_ROOT] }).map((agent) => agent.id);
const INSTALL_FILES = ['install.en_US.md', 'install.pt_BR.md'];
const MATRIX_SNIPPETS = ['apps/docs/snippets/agents/matrix.mdx', 'apps/docs/snippets/pt-br/agents/matrix.mdx'];
const MATRIX_PAGES = ['apps/docs/agents/supported-agents.mdx', 'apps/docs/pt-br/agents/supported-agents.mdx'];
const MATRIX_TABLE_ROW_PATTERN = /^\| -{3,}/m;
const ENUM_MEMBER_PATTERN = /^\s*(\w+) = '([a-z0-9-]+)',?$/;

type Fixture = { id: string; member: string; englishName: string; portugueseName: string };

const INSTALL_FIXTURE: Fixture = {
  id: 'fixture-agent',
  member: 'FixtureAgent',
  englishName: 'Fixture Agent',
  portugueseName: 'Agente de teste',
};
const CONNECTOR_FIXTURE: Fixture = {
  id: 'fixture-connector-agent',
  member: 'FixtureConnectorAgent',
  englishName: 'Fixture Connector Agent',
  portugueseName: 'Agente conector de teste',
};
const PLUGIN_FIXTURE: Fixture = {
  id: 'fixture-plugin-agent',
  member: 'FixturePluginAgent',
  englishName: 'Fixture Plugin Agent',
  portugueseName: 'Agente plugin de teste',
};

async function planWith(input: { extraRoots: string[]; readFile: (path: string) => string }): Promise<GenerationPlan> {
  const agents = discoverAgents({ roots: [SUPPORTED_ROOT, ...input.extraRoots] });
  return planGeneratedFiles({ agents, readSource: input.readFile, listSource });
}

function contentOf(input: { plan: GenerationPlan; path: string }): string {
  const write = input.plan.writes.find((candidate) => candidate.path === input.path);
  if (!write) throw new Error(`the plan does not write ${input.path}`);
  return write.content;
}

function changedPathsOf(input: { base: GenerationPlan; extended: GenerationPlan }): string[] {
  const baseContent = new Map(input.base.writes.map((write) => [write.path, write.content]));
  return input.extended.writes
    .filter((write) => baseContent.get(write.path) !== write.content)
    .map((write) => write.path)
    .sort();
}

function membersOf(input: { source: string; enumName: string }): string[][] {
  const afterOpening = input.source.split(`export enum ${input.enumName} {`)[1];
  if (afterOpening === undefined) throw new Error(`no enum ${input.enumName} in the source`);
  const block = afterOpening.split('}')[0] as string;
  return block
    .split('\n')
    .map((line) => ENUM_MEMBER_PATTERN.exec(line))
    .flatMap((match) => (match ? [[match[1] as string, match[2] as string]] : []));
}

function installPathsOf(input: { fixture: Fixture }): string[] {
  return INSTALL_FILES.map((file) => `${TESTING_ROOT}/${input.fixture.id}/${file}`);
}

function addedPathsOf(input: { fixture: Fixture }): string[] {
  return [
    `${GENERATED_FOLDER}/ids.ts`,
    `${GENERATED_FOLDER}/definitions.ts`,
    `${GENERATED_FOLDER}/install.ts`,
    ...installPathsOf(input),
    `apps/docs/agents/${input.fixture.id}.mdx`,
    `apps/docs/pt-br/agents/${input.fixture.id}.mdx`,
    ...MATRIX_SNIPPETS,
    DOCS_CONFIG,
  ];
}

function pagesOf(input: { content: string; group: string; language: string }): string[] {
  const languages = JSON.parse(input.content).navigation.languages as { language: string; groups: { group: string; pages: string[] }[] }[];
  const language = languages.find((candidate) => candidate.language === input.language);
  const group = language?.groups.find((candidate) => candidate.group === input.group);
  if (!group) throw new Error(`no ${input.group} group for ${input.language}`);
  return group.pages;
}

async function realPlan(): Promise<GenerationPlan> {
  return planWith({ extraRoots: [], readFile: readSource });
}

describe('the generated files', () => {
  test('every generated file is fresh', async () => {
    expect(writePlan({ plan: await realPlan(), mode: GenerationMode.Check })).toEqual([]);
  });

  test('every agent page in apps/docs is the copy of its folder page', async () => {
    const { violations } = await realPlan();
    expect(violations.filter((violation) => violation.includes(' has no page.'))).toEqual([]);
  });

  test.each(MATRIX_PAGES.map((page, index) => ({ page, snippet: MATRIX_SNIPPETS[index] as string })))(
    'the matrix page $page shows the generated snippet and holds no table',
    ({ page, snippet }) => {
      const source = readSource(page);
      expect(source).toContain(`import AgentMatrix from '${snippet.replace('apps/docs', '')}';`);
      expect(source).toContain('<AgentMatrix />');
      expect(source).not.toMatch(MATRIX_TABLE_ROW_PATTERN);
    },
  );

  test('the plan has no violations', async () => {
    const { violations } = await realPlan();
    expect(violations).toEqual([]);
  });
});

describe('adding an agent folder', () => {
  test('G1: an install agent changes exactly the generated set', async () => {
    const extended = await planWith({ extraRoots: [`${TESTING_ROOT}/${INSTALL_FIXTURE.id}`], readFile: readSource });
    expect(changedPathsOf({ base: await realPlan(), extended })).toEqual(addedPathsOf({ fixture: INSTALL_FIXTURE }).sort());
    expect(extended.deletions).toEqual((await realPlan()).deletions);
  });

  test('G1: the fixture appears in the ids, the matrices, the navigation and the install section', async () => {
    const extended = await planWith({ extraRoots: [`${TESTING_ROOT}/${INSTALL_FIXTURE.id}`], readFile: readSource });
    const ids = contentOf({ plan: extended, path: `${GENERATED_FOLDER}/ids.ts` });
    ['AgentId', 'InstallClient'].forEach((enumName) =>
      expect(membersOf({ source: ids, enumName })).toContainEqual([INSTALL_FIXTURE.member, INSTALL_FIXTURE.id]),
    );
    expect(contentOf({ plan: extended, path: MATRIX_SNIPPETS[0] as string })).toContain(
      `[${INSTALL_FIXTURE.englishName}](/agents/${INSTALL_FIXTURE.id})`,
    );
    expect(contentOf({ plan: extended, path: MATRIX_SNIPPETS[1] as string })).toContain(
      `[${INSTALL_FIXTURE.portugueseName}](/pt-br/agents/${INSTALL_FIXTURE.id})`,
    );
    const docsConfig = contentOf({ plan: extended, path: DOCS_CONFIG });
    expect(pagesOf({ content: docsConfig, group: 'Agents', language: 'en' })).toContain(`agents/${INSTALL_FIXTURE.id}`);
    expect(pagesOf({ content: docsConfig, group: 'IAs', language: 'pt-BR' })).toContain(`pt-br/agents/${INSTALL_FIXTURE.id}`);
    installPathsOf({ fixture: INSTALL_FIXTURE }).forEach((path) =>
      expect(contentOf({ plan: extended, path }).match(/^## Fixture Agent$/gm)).toHaveLength(1),
    );
    expect(contentOf({ plan: extended, path: `${GENERATED_FOLDER}/install.ts` })).toContain('fixture-agent/install');
    expect(extended.violations).toEqual((await realPlan()).violations);
  });

  test('G2: every path read for the fixture is inside its folder', async () => {
    const paths: string[] = [];
    const spy = (path: string): string => {
      paths.push(path);
      return readSource(path);
    };
    await planWith({ extraRoots: [`${TESTING_ROOT}/${INSTALL_FIXTURE.id}`], readFile: spy });
    const fixturePaths = paths.filter((path) => path.includes(INSTALL_FIXTURE.id));
    expect(fixturePaths.length).toBeGreaterThan(0);
    fixturePaths.forEach((path) => expect(path.startsWith(`${TESTING_ROOT}/${INSTALL_FIXTURE.id}/`)).toBe(true));
  });

  test('G2c: a connector agent adds the connector registry and the two connector snippets', async () => {
    const extended = await planWith({ extraRoots: [`${TESTING_ROOT}/${CONNECTOR_FIXTURE.id}`], readFile: readSource });
    expect(changedPathsOf({ base: await realPlan(), extended })).toEqual(
      [...addedPathsOf({ fixture: CONNECTOR_FIXTURE }), `${GENERATED_FOLDER}/connector.ts`].sort(),
    );
    const ids = contentOf({ plan: extended, path: `${GENERATED_FOLDER}/ids.ts` });
    expect(membersOf({ source: ids, enumName: 'ConnectorClient' })).toContainEqual([CONNECTOR_FIXTURE.member, CONNECTOR_FIXTURE.id]);
  });

  test('G2b: a plugin agent adds the plugin registry', async () => {
    const extended = await planWith({ extraRoots: [`${TESTING_ROOT}/${PLUGIN_FIXTURE.id}`], readFile: readSource });
    expect(changedPathsOf({ base: await realPlan(), extended })).toEqual(
      [...addedPathsOf({ fixture: PLUGIN_FIXTURE }), `${GENERATED_FOLDER}/plugins.ts`, WORKFLOW_FILE].sort(),
    );
    const ids = contentOf({ plan: extended, path: `${GENERATED_FOLDER}/ids.ts` });
    const realIds = contentOf({ plan: await realPlan(), path: `${GENERATED_FOLDER}/ids.ts` });
    const members = membersOf({ source: ids, enumName: 'PluginAgent' });
    expect(members).toHaveLength(membersOf({ source: realIds, enumName: 'PluginAgent' }).length + 1);
    expect(members).toContainEqual([PLUGIN_FIXTURE.member, PLUGIN_FIXTURE.id]);
  });
});

describe('removing an agent folder', () => {
  async function planWithout(input: { id: string }): Promise<GenerationPlan> {
    const agents = discoverAgents({ roots: [SUPPORTED_ROOT] }).filter((agent) => agent.id !== input.id);
    return planGeneratedFiles({ agents, readSource, listSource });
  }

  test.each(REAL_AGENT_IDS)('G3: %s vanishes from every planned file', async (id) => {
    const removed = await planWithout({ id });
    expect(removed.deletions.sort()).toEqual([`apps/docs/agents/${id}.mdx`, `apps/docs/pt-br/agents/${id}.mdx`]);
    const violationsOfOthers = (await realPlan()).violations.filter((violation) => !violation.startsWith(`${id} `));
    expect(removed.violations).toEqual(violationsOfOthers);
    removed.writes.forEach((write) => {
      expect(write.content).not.toContain(`agents/${id})`);
      expect(write.content).not.toContain(`'${id}'`);
    });
    MATRIX_SNIPPETS.forEach((path) =>
      expect(contentOf({ plan: removed, path }).match(/\]\(\/(?:pt-br\/)?agents\//g)).toHaveLength(REAL_AGENT_IDS.length - 1),
    );
  });
});

describe('page rules', () => {
  const pageOf = (input: { fixture: Fixture; file: string }): string => `${TESTING_ROOT}/${input.fixture.id}/${input.file}`;
  const PAGE_RULE_MUTATIONS = [
    { name: 'the front matter of a plugin page', fixture: PLUGIN_FIXTURE, file: 'page.en.mdx', remove: /^---[\s\S]*?---\n/ },
    { name: 'the install command of a plugin page', fixture: PLUGIN_FIXTURE, file: 'page.en.mdx', remove: /```bash[\s\S]*?```/ },
    {
      name: 'the one-listener sentence of a plugin page',
      fixture: PLUGIN_FIXTURE,
      file: 'page.pt-br.mdx',
      remove: 'Rode apenas um listener por agente',
    },
    { name: 'the self-test text of a plugin page', fixture: PLUGIN_FIXTURE, file: 'page.pt-br.mdx', remove: /✅ instalado/g },
    { name: 'the placeholder of a step guide', fixture: INSTALL_FIXTURE, file: 'page.en.mdx', remove: /<connectionLink>/g },
  ];

  test.each(PAGE_RULE_MUTATIONS)('removing $name fails the plan naming the page', async ({ fixture, file, remove }) => {
    const path = pageOf({ fixture, file });
    const mutated = (source: string): string => source.replace(remove, 'removed');
    const plan = await planWith({
      extraRoots: [`${TESTING_ROOT}/${fixture.id}`],
      readFile: (candidate) => (candidate === path ? mutated(readSource(candidate)) : readSource(candidate)),
    });
    expect(plan.violations.some((entry) => entry.startsWith(`${fixture.id} ${file}`))).toBe(true);
  });
});

describe('agent knowledge', () => {
  const runtimeOf = (id: string): AgentConnectorRuntime | null => {
    const found = Object.entries(CONNECTOR_RUNTIMES).find(([runtimeId]) => runtimeId === id);
    return found === undefined ? null : found[1];
  };
  const agents = Object.entries(AGENT_DEFINITIONS).map(([id, definition]) => ({ id, definition, runtime: runtimeOf(id) }));
  const files = trackedFiles().map((path) => ({ path, text: readRepositoryFile(path) }));
  const leaks = treeLeakViolationsOf({ agents, files });

  test('no file outside an agent folder names an agent', () => {
    expect(leaks).toEqual([]);
  });

  test.each(REAL_AGENT_IDS)('G4: %s leaks nowhere', (id) => {
    expect(leaks.filter((leak) => leak.endsWith(` names ${id}`))).toEqual([]);
  });
});

describe('agent boundaries', () => {
  test('the repository keeps the import boundaries of ADR 0033', () => {
    const files = trackedFiles().map((path) => ({ path, text: readRepositoryFile(path) }));
    expect(treeBoundaryViolationsOf({ files })).toEqual([]);
  });
});
