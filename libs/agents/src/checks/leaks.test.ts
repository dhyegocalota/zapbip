import { describe, expect, test } from 'vitest';
import { leakViolationsOf, withoutAgentNavigationLists, withoutGeneratedWorkflowRegions, type LeakAgent, type LeakFile } from './leaks';

const ALPHA: LeakAgent = { id: 'alpha', enumMember: 'Alpha', isOrdinaryWord: true, literals: ['.alpha-home', 'ALPHA_HOME'] };
const HERMES: LeakAgent = { id: 'beta', enumMember: 'Beta', isOrdinaryWord: true, literals: [] };
const DELTA: LeakAgent = { id: 'delta', enumMember: 'Delta', isOrdinaryWord: false, literals: [] };
const GAMMA: LeakAgent = { id: 'gamma-bot', enumMember: 'GammaBot', isOrdinaryWord: false, literals: [] };
const GENERATED_PREFIX = 'libs/agents/src/generated/';

function leaksIn({
  files,
  agents = [ALPHA, HERMES],
  literalExemptPrefixes = [],
}: {
  files: LeakFile[];
  agents?: LeakAgent[];
  literalExemptPrefixes?: string[];
}): string[] {
  return leakViolationsOf({ agents, files, allowedPrefixes: [GENERATED_PREFIX], literalExemptPrefixes });
}

describe('leakViolationsOf: constants, exemptions and generated regions', () => {
  test.each(['export const GAMMA_BOT_VERSION = 1;', 'GAMMA_BOT', 'ZAPBIP_GAMMA_BOT_HOME'.replace('ZAPBIP_', '')])(
    'names the constant word in %s',
    (text) => {
      expect(leaksIn({ files: [{ path: 'libs/types/example.ts', text }], agents: [GAMMA] })).toEqual([
        'libs/types/example.ts:1 names gamma-bot',
      ]);
    },
  );

  test.each(['XGAMMA_BOT', 'GAMMA_BOTS', 'GAMMA_BOT2'])('ignores %s, which only contains the constant word', (text) => {
    expect(leaksIn({ files: [{ path: 'libs/types/example.ts', text }], agents: [GAMMA] })).toEqual([]);
  });

  test('names an uppercase single word id too', () => {
    expect(leaksIn({ files: [{ path: 'libs/types/example.ts', text: 'export const ALPHA_VERSION = 1;' }] })).toEqual([
      'libs/types/example.ts:1 names alpha',
    ]);
  });

  test('waives only the home literals in a literal-exempt file', () => {
    const files = [{ path: '.agents/hooks/doctor.sh', text: 'ls ~/.alpha-home\npip install -r apps/alpha-plugin/requirements-dev.txt' }];
    expect(leaksIn({ files, literalExemptPrefixes: ['.agents/hooks/doctor.sh'] })).toEqual(['.agents/hooks/doctor.sh:2 names alpha']);
  });

  test('drops only the generated regions of a workflow', () => {
    const text = [
      'keep alpha',
      '# NB ADR 0033: generated unit matrix rows begin',
      'drop alpha',
      '# NB ADR 0033: generated unit matrix rows end',
      'keep too',
    ].join('\n');
    expect(withoutGeneratedWorkflowRegions({ text })).toBe(['keep alpha', 'keep too'].join('\n'));
  });

  test('keeps a planted line next to a generated region', () => {
    const text = [
      '# NB ADR 0033: generated pip install lines begin',
      'x',
      '# NB ADR 0033: generated pip install lines end',
      'planted alpha-plugin',
    ].join('\n');
    expect(withoutGeneratedWorkflowRegions({ text })).toBe('planted alpha-plugin');
  });

  test('empties the agent page lists of the navigation and keeps everything else', () => {
    const source = JSON.stringify({
      navigation: {
        languages: [
          {
            language: 'en',
            groups: [
              { group: 'Agents', pages: ['agents/a'] },
              { group: 'Help', pages: ['help/planted-alpha'] },
            ],
          },
        ],
      },
    });
    const kept = JSON.parse(withoutAgentNavigationLists({ text: source }));
    expect(kept.navigation.languages[0].groups[0].pages).toEqual([]);
    expect(kept.navigation.languages[0].groups[1].pages).toEqual(['help/planted-alpha']);
  });
});

describe('leakViolationsOf: ids in every position', () => {
  test.each(['const agents = { delta: 1, other: 3 };', 'run delta now', "'delta-ide'", "'delta.sh'", '"delta_two"', 'delta'])(
    'names an id that is not an ordinary word in %s',
    (text) => {
      expect(leaksIn({ files: [{ path: 'tools/example.ts', text }], agents: [DELTA] })).toEqual(['tools/example.ts:1 names delta']);
    },
  );

  test.each(['deltabet', 'xdelta', 'delta2'])('ignores %s, which only contains the id', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }], agents: [DELTA] })).toEqual([]);
  });

  test.each(["'beta'", "'beta-ide'", "'beta.sh'", '"beta_two"', '`beta-agent`'])(
    'names a quoted string that starts with an ordinary-word id in %s',
    (text) => {
      expect(leaksIn({ files: [{ path: 'tools/example.ts', text }], agents: [HERMES] })).toEqual(['tools/example.ts:1 names beta']);
    },
  );

  test.each(['const page = bucket.list({ beta: input.beta });', 'sql.exec(beta)', "'betamax'", 'beta.value'])(
    'leaves an ordinary-word id alone in %s',
    (text) => {
      expect(leaksIn({ files: [{ path: 'tools/example.ts', text }], agents: [HERMES] })).toEqual([]);
    },
  );
});

describe('leakViolationsOf: bare names', () => {
  test.each(['run gamma-bot now', 'agents/gamma-bot)', '"gamma-bot hint"'])('names the bare hyphenated id in %s', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }], agents: [GAMMA] })).toEqual(['tools/example.ts:1 names gamma-bot']);
  });

  test.each(['gamma-bots', 'xgamma-bot', 'gamma-bot2', 'developers/gamma-bot'])('ignores %s, which only contains the id', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }], agents: [GAMMA] })).toEqual([]);
  });

  test('leaves an id that is an ordinary word alone unless it is quoted', () => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text: 'the beta release' }] })).toEqual([]);
  });

  test.each(['PreflightStep.AlphaWheel', 'refuseAlphaWheel', 'nextAlpha', 'the Alpha plugin'])('names the product word of %s', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual(['tools/example.ts:1 names alpha']);
  });

  test.each(['Alphabet', 'alphaValue', 'ALPHAS'])('ignores %s, which only contains the product word', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual([]);
  });

  test('names the plugin package folder outside the plugin', () => {
    const files = [{ path: '.agents/hooks/doctor.sh', text: 'pip install -r apps/alpha-plugin/requirements-dev.txt' }];
    expect(leaksIn({ files })).toEqual(['.agents/hooks/doctor.sh:1 names alpha']);
  });
});

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

  test.each(['.alpha-homes'])('ignores %s, which only contains a literal', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual([]);
  });

  test.each([`'alpha'`, `"alpha"`, '`alpha`'])('names the quoted id literal %s outside the folder', (literal) => {
    const files = [{ path: 'tools/example.ts', text: `const first = 1;\nconst agent = ${literal};` }];
    expect(leaksIn({ files })).toEqual(['tools/example.ts:2 names alpha']);
  });

  test('accepts the quoted id literal inside the agent folder', () => {
    const files = [{ path: 'libs/agents/supported/alpha/definition.ts', text: "const id = 'alpha';" }];
    expect(leaksIn({ files })).toEqual([]);
  });

  test.each(["'alphabet'", 'alpha', "'xalpha'"])('ignores %s, which is not the quoted id', (text) => {
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

  test.each(['database alpha', 'api2.alpha.sh', 'supported/alpha-extra'])('ignores %s', (text) => {
    expect(leaksIn({ files: [{ path: 'tools/example.ts', text }] })).toEqual([]);
  });
});
