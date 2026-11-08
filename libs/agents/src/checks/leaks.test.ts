import { describe, expect, test } from 'vitest';
import { leakViolationsOf, type LeakAgent, type LeakFile } from './leaks';

const ALPHA: LeakAgent = { id: 'alpha', enumMember: 'Alpha', literals: ['.alpha-home', 'ALPHA_HOME'] };
const HERMES: LeakAgent = { id: 'beta', enumMember: 'Beta', literals: [] };
const GENERATED_PREFIX = 'libs/agents/src/generated/';

function leaksIn(input: { files: LeakFile[]; agents?: LeakAgent[] }): string[] {
  return leakViolationsOf({ agents: input.agents ?? [ALPHA, HERMES], files: input.files, allowedPrefixes: [GENERATED_PREFIX] });
}

describe('leakViolationsOf', () => {
  test.each(['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent'])('names the file and line that uses %s.Alpha', (enumName) => {
    const files = [{ path: 'tools/example.ts', text: `const first = 1;\nconst second = ${enumName}.Alpha;` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:2 names alpha']);
  });

  test('names a record keyed by an enum member', () => {
    const files = [{ path: 'tools/example.ts', text: `const facts = {\n  [InstallClient.Beta]: 1,\n};` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:2 names beta']);
  });

  test.each(['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent'])('names a record keyed by the whole %s enum', (enumName) => {
    const files = [{ path: 'libs/core/example.ts', text: `const labels = 1;\nconst names: Record<${enumName}, string> = {};` }];
    expect(leaksIn({ files })).toEqual([`libs/core/example.ts:2 keys a record by ${enumName}`]);
  });

  test('accepts a record keyed by the enum inside the generated outputs', () => {
    const files = [{ path: `${GENERATED_PREFIX}install.ts`, text: 'const names: Record<InstallClient, string> = {};' }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test.each(['.alpha-home', 'ALPHA_HOME'])('names the literal %s of an agent outside its folder', (literal) => {
    const files = [{ path: 'apps/connector/src/example.ts', text: `const first = 1;\nconst home = join(homedir(), '${literal}');` }];
    expect(leaksIn({ files })).toEqual(['apps/connector/src/example.ts:2 names alpha']);
  });

  test('accepts the literals inside the agent folder', () => {
    const files = [{ path: 'libs/agents/supported/alpha/connector.ts', text: "process.env.ALPHA_HOME; join(home, '.alpha-home')" }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test.each(['MY_ALPHA_HOME', 'ALPHA_HOME_EXTRA', '.alpha-homes'])('ignores %s, which only contains a literal', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual([]);
  });

  test('names a path under supported/<id>', () => {
    const files = [{ path: 'tools/example.ts', text: `import { definition } from '../supported/alpha/definition';` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:1 names alpha']);
  });

  test('lists every agent a line names, once per agent', () => {
    const files = [{ path: 'tools/example.ts', text: 'const both = [AgentId.Alpha, AgentId.Beta, AgentId.Alpha];' }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:1 names alpha', 'tools/example.ts:1 names beta']);
  });

  test('accepts the agent folder itself', () => {
    const files = [{ path: 'libs/agents/supported/alpha/definition.ts', text: 'AgentId.Alpha supported/alpha' }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test('accepts the plugin package of the agent', () => {
    const files = [{ path: 'apps/beta-plugin/e2e/client.ts', text: 'PluginAgent.Beta' }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test('rejects another agent folder naming the agent', () => {
    const files = [{ path: 'libs/agents/supported/beta/install.ts', text: 'InstallClient.Alpha' }];
    expect(leaksIn({ files })).toEqual(['libs/agents/supported/beta/install.ts:1 names alpha']);
  });

  test('accepts the generated outputs', () => {
    const files = [{ path: `${GENERATED_PREFIX}ids.ts`, text: "Alpha = 'alpha'; AgentId.Alpha" }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test.each(['InstallClient.AlphaLike', 'database alpha', 'api2.alpha.sh', 'supported/alpha-extra', 'MyInstallClient.Alpha'])(
    'ignores %s',
    (text) => {
      expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual([]);
    },
  );
});
