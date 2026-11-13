import { readdirSync } from 'node:fs';
import { WakeRung } from '@zapbip/types';
import { perLanguage } from '../src/docs';
import type { AgentDefinition } from '../src/contract';
import { AgentFacet } from '../src/contract';
import type { ResolvedAgent } from './agent';
import { discoverAgents } from './discover';
import { loadAgent } from './load';
import { SUPPORTED_FOLDER, repositoryPath } from './repository';
import { definition as sampleBaseDefinition } from '../testing/fixture-agent/definition';

const DEFINITION_MODULE = 'definition';

export const REAL_AGENT_IDS: string[] = readdirSync(repositoryPath(SUPPORTED_FOLDER), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export function resolvedAgentOf(input: { id: string; folder: string; definition: AgentDefinition; facets: AgentFacet[] }): ResolvedAgent {
  return { ...input, install: null, plugin: null };
}

export async function realAgents(): Promise<ResolvedAgent[]> {
  return Promise.all(
    REAL_AGENT_IDS.map(async (id) => {
      const { definition } = (await import(`../supported/${id}/${DEFINITION_MODULE}`)) as { definition: AgentDefinition };
      return resolvedAgentOf({ id, folder: `${SUPPORTED_FOLDER}/${id}`, definition, facets: [AgentFacet.Definition] });
    }),
  );
}

export function definitionsOf(input: { agents: ResolvedAgent[] }): Record<string, AgentDefinition> {
  return Object.fromEntries(input.agents.map((agent) => [agent.id, agent.definition]));
}

const FIXTURE_ROOT = 'libs/agents/testing';
const FIXTURE_IDS = ['fixture-agent', 'fixture-connector-agent', 'fixture-plugin-agent'];

export async function fixtureAgents(): Promise<ResolvedAgent[]> {
  const loaded = await Promise.all(
    discoverAgents({ roots: FIXTURE_IDS.map((id) => `${FIXTURE_ROOT}/${id}`) }).map((agent) => loadAgent({ agent })),
  );
  return loaded.map((agent) => ({ ...agent, definition: agent.definition as AgentDefinition }));
}

export function sampleDefinitionOf(input: { name: string; rung: WakeRung; expectedDelaySeconds: number | null }): AgentDefinition {
  const names = perLanguage({ valueOf: () => input.name });
  return {
    ...sampleBaseDefinition,
    docs: { ...sampleBaseDefinition.docs, matrixName: names, linkName: names },
    listen: { ...sampleBaseDefinition.listen, rung: input.rung, expectedDelaySeconds: input.expectedDelaySeconds },
  };
}

export const SAMPLE_IDS_IN_ORDER = ['alpha-local', 'zeta-local', 'beta-webhook', 'gamma-scheduled', 'delta-standby', 'epsilon-inbox'];

const SAMPLES: { id: string; name: string; rung: WakeRung; expectedDelaySeconds: number | null }[] = [
  { id: 'epsilon-inbox', name: 'Epsilon Inbox', rung: WakeRung.Inbox, expectedDelaySeconds: null },
  { id: 'zeta-local', name: 'Zeta Local', rung: WakeRung.Local, expectedDelaySeconds: 6 },
  { id: 'gamma-scheduled', name: 'Gamma Scheduled', rung: WakeRung.Scheduled, expectedDelaySeconds: 3600 },
  { id: 'alpha-local', name: 'Alpha Local', rung: WakeRung.Local, expectedDelaySeconds: 7 },
  { id: 'delta-standby', name: 'Delta Standby', rung: WakeRung.Standby, expectedDelaySeconds: null },
  { id: 'beta-webhook', name: 'Beta Webhook', rung: WakeRung.Webhook, expectedDelaySeconds: 9 },
];

export function sampleAgents(): ResolvedAgent[] {
  return SAMPLES.map((sample) =>
    resolvedAgentOf({
      id: sample.id,
      folder: `${SUPPORTED_FOLDER}/${sample.id}`,
      definition: sampleDefinitionOf(sample),
      facets: [AgentFacet.Definition],
    }),
  );
}
