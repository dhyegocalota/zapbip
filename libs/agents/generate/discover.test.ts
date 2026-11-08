import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { AgentFacet } from '../src/contract';
import { discoverAgents } from './discover';
import { REAL_AGENT_IDS } from './test-agents';

const FIXTURE_ROOT = 'libs/agents/testing';
const SUPPORTED_ROOT = 'libs/agents/supported';

describe('discoverAgents', () => {
  test('lists the folders under supported in name order', () => {
    const agents = discoverAgents({ roots: [SUPPORTED_ROOT] });
    expect(agents.map((agent) => agent.id)).toEqual(REAL_AGENT_IDS);
    expect(agents.every((agent) => agent.folder === `${SUPPORTED_ROOT}/${agent.id}`)).toBe(true);
  });

  test('takes a root that is itself an agent folder', () => {
    const agents = discoverAgents({ roots: [`${FIXTURE_ROOT}/fixture-agent`, `${FIXTURE_ROOT}/fixture-plugin-agent`] });
    expect(agents.map((agent) => agent.id)).toEqual(['fixture-agent', 'fixture-plugin-agent']);
  });

  test('reads the facets from the files that are present', () => {
    const [installAgent, connectorAgent, pluginAgent] = discoverAgents({
      roots: ['fixture-agent', 'fixture-connector-agent', 'fixture-plugin-agent'].map((id) => `${FIXTURE_ROOT}/${id}`),
    });
    const commonFacets = [AgentFacet.Definition, AgentFacet.EnglishPage, AgentFacet.PortuguesePage, AgentFacet.Install];
    expect(installAgent?.facets).toEqual(commonFacets);
    expect(connectorAgent?.facets).toEqual([...commonFacets, AgentFacet.Connector]);
    expect(pluginAgent?.facets).toEqual([...commonFacets, AgentFacet.Plugin]);
  });

  test('a root that does not exist has no agents', () => {
    expect(discoverAgents({ roots: ['libs/agents/nowhere'] })).toEqual([]);
  });
});

describe('discoverAgents in a repository with leftovers', () => {
  let base = '';

  function git(...args: string[]): void {
    const result = spawnSync('git', args, { cwd: base, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
  }

  function write(path: string): void {
    mkdirSync(dirname(join(base, path)), { recursive: true });
    writeFileSync(join(base, path), 'x');
  }

  afterEach(() => rmSync(base, { recursive: true, force: true }));

  test('finds the folders with listed files and ignores one that only holds ignored leftovers or was removed', () => {
    base = mkdtempSync(join(tmpdir(), 'discover-'));
    git('init', '--quiet');
    write('.gitignore');
    writeFileSync(join(base, '.gitignore'), 'node_modules/\n');
    write('agents/alpha/definition.ts');
    write('agents/delta/definition.ts');
    git('add', '--', '.gitignore', 'agents/alpha', 'agents/delta');
    git('rm', '-rqf', '--', 'agents/delta');
    write('agents/beta/node_modules/leftover.js');
    write('agents/delta/node_modules/leftover.js');
    write('agents/gamma/definition.ts');
    expect(discoverAgents({ roots: ['agents'], base }).map((agent) => agent.id)).toEqual(['alpha', 'gamma']);
  });
});
