import { describe, expect, test } from 'vitest';
import { AgentFacet, type AgentPlugin } from '../src/contract';
import { plugin as fixturePlugin } from '../testing/fixture-plugin-agent/plugin';
import { definition } from '../testing/fixture-plugin-agent/definition';
import { renderWorkflow } from './render-workflow';
import { resolvedAgentOf } from './test-agents';

const MATRIX_BEGIN = '      # NB ADR 0033: generated unit matrix rows begin';
const MATRIX_END = '      # NB ADR 0033: generated unit matrix rows end';
const PIP_BEGIN = '      # NB ADR 0033: generated pip install lines begin';
const PIP_END = '      # NB ADR 0033: generated pip install lines end';
const SOURCE = [
  'jobs:',
  '  unit:',
  '    steps:',
  MATRIX_BEGIN,
  '      - { name: stale, filter: "stale" }',
  MATRIX_END,
  PIP_BEGIN,
  '      - run: stale',
  PIP_END,
  '      - run: pnpm test',
].join('\n');

function agentWith(input: { id: string; plugin: AgentPlugin }) {
  return {
    ...resolvedAgentOf({ id: input.id, folder: `supported/${input.id}`, definition, facets: [AgentFacet.Definition, AgentFacet.Plugin] }),
    plugin: input.plugin,
  };
}

describe('renderWorkflow', () => {
  test('hands the requirements path to the step through the environment, never inline', () => {
    const plugin = { ...fixturePlugin, workflow: { name: 'x', filter: 'x', pythonRequirements: 'x/requirements-dev.txt' } };
    const rendered = renderWorkflow({ source: SOURCE, agents: [agentWith({ id: 'x', plugin })] });
    expect(rendered).toContain('REQUIREMENTS: x/requirements-dev.txt');
    expect(rendered).not.toMatch(/pip install[^\n]*requirements-dev\.txt/);
  });

  test('rewrites the matrix rows and the pip lines from the plugin workflows', () => {
    const plugin = {
      ...fixturePlugin,
      workflow: { name: 'fixture', filter: '@zapbip/fixture', pythonRequirements: 'fixture/requirements-dev.txt' },
    };
    expect(renderWorkflow({ source: SOURCE, agents: [agentWith({ id: 'fixture', plugin })] })).toBe(
      [
        'jobs:',
        '  unit:',
        '    steps:',
        MATRIX_BEGIN,
        '      - { name: fixture, filter: "@zapbip/fixture" }',
        MATRIX_END,
        PIP_BEGIN,
        '      - run: python3 -m pip install --require-hashes -r "$REQUIREMENTS"',
        '        env:',
        '          REQUIREMENTS: fixture/requirements-dev.txt',
        PIP_END,
        '      - run: pnpm test',
      ].join('\n'),
    );
  });

  test('writes one pip line for plugins that share a requirements file and none for plugins without one', () => {
    const shared = { ...fixturePlugin, workflow: { name: 'first', filter: 'first', pythonRequirements: 'shared.txt' } };
    const second = { ...fixturePlugin, workflow: { name: 'second', filter: 'second', pythonRequirements: 'shared.txt' } };
    const bare = { ...fixturePlugin, workflow: { name: 'bare', filter: 'bare', pythonRequirements: null } };
    const agents = [
      agentWith({ id: 'first', plugin: shared }),
      agentWith({ id: 'second', plugin: second }),
      agentWith({ id: 'bare', plugin: bare }),
    ];
    const rendered = renderWorkflow({ source: SOURCE, agents });
    expect(rendered.match(/python3 -m pip install/g)).toHaveLength(1);
    expect(rendered.match(/- \{ name:/g)).toHaveLength(3);
  });

  test('is stable when rendered twice', () => {
    const agents = [agentWith({ id: 'fixture', plugin: fixturePlugin })];
    const once = renderWorkflow({ source: SOURCE, agents });
    expect(renderWorkflow({ source: once, agents })).toBe(once);
  });

  test('refuses a workflow that lacks a region', () => {
    expect(() => renderWorkflow({ source: 'jobs:', agents: [] })).toThrow('verify.yml has no unit matrix rows region to rewrite');
  });
});
