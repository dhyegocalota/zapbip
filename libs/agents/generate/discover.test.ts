import { describe, expect, test } from 'vitest';
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

  test('a real agent with only a definition has only that facet', () => {
    const cursor = discoverAgents({ roots: [SUPPORTED_ROOT] }).find((agent) => agent.id === 'cursor');
    expect(cursor?.facets).toEqual([AgentFacet.Definition]);
  });

  test('a root that does not exist has no agents', () => {
    expect(discoverAgents({ roots: ['libs/agents/nowhere'] })).toEqual([]);
  });
});
