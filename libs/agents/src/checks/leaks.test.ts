import { describe, expect, test } from 'vitest';
import { leakViolationsOf, type LeakAgent, type LeakFile } from './leaks';

const CURSOR: LeakAgent = { id: 'cursor', enumMember: 'Cursor' };
const HERMES: LeakAgent = { id: 'hermes', enumMember: 'Hermes' };
const GENERATED_PREFIX = 'libs/agents/src/generated/';

function leaksIn(input: { files: LeakFile[]; agents?: LeakAgent[] }): string[] {
  return leakViolationsOf({ agents: input.agents ?? [CURSOR, HERMES], files: input.files, allowedPrefixes: [GENERATED_PREFIX] });
}

describe('leakViolationsOf', () => {
  test.each(['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent'])('names the file and line that uses %s.Cursor', (enumName) => {
    const files = [{ path: 'tools/example.ts', text: `const first = 1;\nconst second = ${enumName}.Cursor;` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:2 names cursor']);
  });

  test('names a record keyed by an enum member', () => {
    const files = [{ path: 'tools/example.ts', text: `const facts = {\n  [InstallClient.Hermes]: 1,\n};` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:2 names hermes']);
  });

  test.each(['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent'])('names a record keyed by the whole %s enum', (enumName) => {
    const files = [{ path: 'libs/core/example.ts', text: `const labels = 1;\nconst names: Record<${enumName}, string> = {};` }];
    expect(leaksIn({ files })).toEqual([`libs/core/example.ts:2 keys a record by ${enumName}`]);
  });

  test('accepts a record keyed by the enum inside the generated outputs', () => {
    const files = [{ path: `${GENERATED_PREFIX}install.ts`, text: 'const names: Record<InstallClient, string> = {};' }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test('names a path under supported/<id>', () => {
    const files = [{ path: 'tools/example.ts', text: `import { definition } from '../supported/cursor/definition';` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:1 names cursor']);
  });

  test('lists every agent a line names, once per agent', () => {
    const files = [{ path: 'tools/example.ts', text: 'const both = [AgentId.Cursor, AgentId.Hermes, AgentId.Cursor];' }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:1 names cursor', 'tools/example.ts:1 names hermes']);
  });

  test('accepts the agent folder itself', () => {
    const files = [{ path: 'libs/agents/supported/cursor/definition.ts', text: 'AgentId.Cursor supported/cursor' }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test('accepts the plugin package of the agent', () => {
    const files = [{ path: 'apps/hermes-plugin/e2e/client.ts', text: 'PluginAgent.Hermes' }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test('rejects another agent folder naming the agent', () => {
    const files = [{ path: 'libs/agents/supported/hermes/install.ts', text: 'InstallClient.Cursor' }];
    expect(leaksIn({ files })).toEqual(['libs/agents/supported/hermes/install.ts:1 names cursor']);
  });

  test('accepts the generated outputs', () => {
    const files = [{ path: `${GENERATED_PREFIX}ids.ts`, text: "Cursor = 'cursor'; AgentId.Cursor" }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test.each(['InstallClient.CursorLike', 'database cursor', 'api2.cursor.sh', 'supported/cursor-extra', 'MyInstallClient.Cursor'])(
    'ignores %s',
    (text) => {
      expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual([]);
    },
  );
});
