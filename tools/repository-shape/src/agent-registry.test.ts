import { describe, expect, test } from 'vitest';
import {
  GenerationMode,
  discoverAgents,
  listSource,
  planGeneratedFiles,
  readSource,
  writePlan,
  type GenerationPlan,
} from '@zapbip/agents/generate';

const SUPPORTED_ROOT = 'libs/agents/supported';
const TESTING_ROOT = 'libs/agents/testing';
const GENERATED_FOLDER = 'libs/agents/src/generated';
const DOCS_CONFIG = 'apps/docs/docs.json';
const REAL_AGENT_IDS = [
  'any-mcp-client',
  'chatgpt',
  'claude-ai',
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'grok-bot',
  'grok-web',
  'hermes',
  'openclaw',
];
const INSTALL_FILES = ['install.en_US.md', 'install.pt_BR.md'];
const MATRIX_SNIPPETS = ['apps/docs/snippets/agents/matrix.mdx', 'apps/docs/snippets/pt-br/agents/matrix.mdx'];
const CONNECTOR_SNIPPETS = ['apps/docs/snippets/agents/connector-clients.mdx', 'apps/docs/snippets/pt-br/agents/connector-clients.mdx'];
const PAGE_NOT_MOVED_YET_PATTERN = / has no page\.(en|pt-br)\.mdx$/;
const ENUM_MEMBER_PATTERN = /^\s*(\w+) = '([a-z-]+)',?$/;

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
  const block = input.source.split(`export enum ${input.enumName} {`)[1]?.split('}')[0] ?? '';
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
  return language?.groups.find((candidate) => candidate.group === input.group)?.pages ?? [];
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
    expect(violations.filter((violation) => PAGE_NOT_MOVED_YET_PATTERN.test(violation))).toEqual([]);
  });

  test('the plan has no violations', async () => {
    const { violations } = await realPlan();
    expect(violations.filter((violation) => !PAGE_NOT_MOVED_YET_PATTERN.test(violation))).toEqual([]);
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
      [...addedPathsOf({ fixture: CONNECTOR_FIXTURE }), `${GENERATED_FOLDER}/connector.ts`, ...CONNECTOR_SNIPPETS].sort(),
    );
    const ids = contentOf({ plan: extended, path: `${GENERATED_FOLDER}/ids.ts` });
    expect(membersOf({ source: ids, enumName: 'ConnectorClient' })).toContainEqual([CONNECTOR_FIXTURE.member, CONNECTOR_FIXTURE.id]);
  });

  test('G2b: a plugin agent adds the plugin registry', async () => {
    const extended = await planWith({ extraRoots: [`${TESTING_ROOT}/${PLUGIN_FIXTURE.id}`], readFile: readSource });
    expect(changedPathsOf({ base: await realPlan(), extended })).toEqual(
      [...addedPathsOf({ fixture: PLUGIN_FIXTURE }), `${GENERATED_FOLDER}/plugins.ts`].sort(),
    );
    const ids = contentOf({ plan: extended, path: `${GENERATED_FOLDER}/ids.ts` });
    expect(membersOf({ source: ids, enumName: 'PluginAgent' })).toEqual([[PLUGIN_FIXTURE.member, PLUGIN_FIXTURE.id]]);
  });
});

describe('removing an agent folder', () => {
  REAL_AGENT_IDS.forEach((id) => test.todo(`G3: ${id} vanishes from every planned file, once its pages live in its folder`));
});

describe('no file outside an agent folder names an agent', () => {
  REAL_AGENT_IDS.forEach((id) => test.todo(`G4: ${id} leaks nowhere, once the leak check exists`));
});
