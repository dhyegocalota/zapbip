import { describe, expect, test } from 'vitest';
import { ScaffoldKind, scaffoldFilesOf } from './scaffold';
import { listTree, readSource } from './source';
import { REAL_AGENT_IDS } from './test-agents';

const TEMPLATE_FOLDER = 'libs/agents/testing/fixture-agent';
const NEW_ID = 'probe-zq-agent';

function scaffold({ id, kind = ScaffoldKind.Install }: { id: string; kind?: ScaffoldKind }) {
  return scaffoldFilesOf({ id, kind, existingIds: REAL_AGENT_IDS, readSource, listTree });
}

function contentOf(input: { files: { path: string; content: string }[]; name: string }): string {
  const file = input.files.find((candidate) => candidate.path === `libs/agents/supported/${NEW_ID}/${input.name}`);
  if (!file) throw new Error(`the scaffold has no ${input.name}`);
  return file.content;
}

describe('scaffoldFilesOf', () => {
  test('copies every file of the template into the new agent folder', () => {
    const files = scaffold({ id: NEW_ID });
    expect(files.map((file) => file.path)).toEqual(listTree(TEMPLATE_FOLDER).map((name) => `libs/agents/supported/${NEW_ID}/${name}`));
  });

  test('renames the id, the enum member and the display names, and keeps nothing of the template', () => {
    const files = scaffold({ id: NEW_ID });
    const definition = contentOf({ files, name: 'definition.ts' });
    expect(definition).toContain("enumMember: 'ProbeZqAgent'");
    expect(definition).toContain("[DocsLanguage.English]: 'Probe Zq Agent'");
    expect(contentOf({ files, name: 'install-copy.ts' })).toContain('renderProbeZqAgentSection');
    expect(contentOf({ files, name: 'page.en.mdx' })).toContain('title: Probe Zq Agent');
    files.forEach((file) => expect(file.content).not.toMatch(/fixture|Agente de teste/i));
  });

  test.each(['Demo', 'demo_agent', '1demo', 'supported-agents', ''])('refuses the invalid id "%s"', (id) => {
    expect(() => scaffold({ id })).toThrow(`${id} is not a valid agent id`);
  });

  test('refuses an id that already has a folder', () => {
    const [existingId] = REAL_AGENT_IDS as [string];
    expect(() => scaffold({ id: existingId })).toThrow(`${existingId} already exists`);
  });
});

describe('scaffoldFilesOf for a connector agent', () => {
  const files = scaffold({ id: NEW_ID, kind: ScaffoldKind.Connector });

  test('copies the connector runtime, its fake client entry, its session writer and its test into the agent folder', () => {
    const paths = files.map((file) => file.path);
    expect(paths).toContain(`libs/agents/supported/${NEW_ID}/connector.ts`);
    expect(paths).toContain(`libs/agents/supported/${NEW_ID}/testing/fake-client.mjs`);
    expect(paths).toContain(`libs/agents/supported/${NEW_ID}/testing/write-session.mjs`);
    expect(paths).toContain(`libs/agents/supported/${NEW_ID}/connector.test.ts`);
  });

  test('names its own binary, home folder and home variable after the id', () => {
    const connector = contentOf({ files, name: 'connector.ts' });
    expect(connector).toContain(`BINARY_NAME = '${NEW_ID}-binary'`);
    expect(connector).toContain(`HOME_VARIABLE = 'PROBE_ZQ_AGENT_HOME'`);
    files.forEach((file) => expect(file.content).not.toMatch(/fixture/i));
  });
});

describe('scaffoldFilesOf for a plugin agent', () => {
  const files = scaffold({ id: NEW_ID, kind: ScaffoldKind.Plugin });
  const packageFiles = files.filter((file) => file.path.startsWith(`apps/${NEW_ID}-plugin/`));

  test('creates the plugin package next to the agent folder, two folders in all', () => {
    expect(packageFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining([`apps/${NEW_ID}-plugin/package.json`, `apps/${NEW_ID}-plugin/release/${NEW_ID}-requirements.txt`]),
    );
    const folders = [`libs/agents/supported/${NEW_ID}/`, `apps/${NEW_ID}-plugin/`];
    files.forEach((file) => expect(folders.some((folder) => file.path.startsWith(folder))).toBe(true));
  });

  test('keeps no word of the template outside the release bytes', () => {
    files.filter((file) => !file.path.includes('/release/')).forEach((file) => expect(file.content).not.toMatch(/fixture/i));
  });

  test('hosts a release file that holds no placeholder hash', () => {
    const release = packageFiles.find((file) => file.path.includes('/release/'));
    expect(release?.content).not.toMatch(/0{64}/);
  });

  test('points the plugin at its own package and keeps the release bytes untouched', () => {
    const plugin = contentOf({ files, name: 'plugin.ts' });
    expect(plugin).toContain(`PACKAGE_FOLDER = 'apps/${NEW_ID}-plugin'`);
    expect(plugin).toContain(`filter: '@zapbip/${NEW_ID}-plugin'`);
    const release = packageFiles.find((file) => file.path.endsWith('-requirements.txt'));
    expect(release?.content).toBe(readSource('libs/agents/testing/fixture-plugin-package/release/fixture-requirements.txt'));
    expect(JSON.parse(packageFiles.find((file) => file.path.endsWith('package.json'))?.content as string).name).toBe(
      `@zapbip/${NEW_ID}-plugin`,
    );
  });

  test('refuses an id whose derived names collide with an existing agent', () => {
    expect(() => scaffoldFilesOf({ id: 'probe-i1', kind: ScaffoldKind.Install, existingIds: ['probe-i-1'], readSource, listTree })).toThrow(
      'probe-i1 collides with probe-i-1 on ProbeI1',
    );
  });
});
