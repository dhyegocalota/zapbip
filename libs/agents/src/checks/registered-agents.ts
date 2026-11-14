import { CHANNEL_PROTOCOLS } from '../generated/channel';
import { CONNECTOR_RUNTIMES } from '../generated/connector';
import { AGENT_DEFINITIONS } from '../generated/definitions';
import { WAKE_TARGETS } from '../generated/wake';
import type { AgentChannelProtocol, AgentConnectorRuntime, AgentDefinition, AgentWakeTarget } from '../contract';
import type { LeakAgent } from './leaks';

type Facets = { runtime: AgentConnectorRuntime | null; wake: AgentWakeTarget | null; channel: AgentChannelProtocol | null };

function facetOf<Facet>(input: { registry: Record<string, Facet>; id: string }): Facet | null {
  const found = Object.entries(input.registry).find(([facetId]) => facetId === input.id);
  return found === undefined ? null : found[1];
}

export function facetsOf(input: { id: string }): Facets {
  const { id } = input;
  return {
    runtime: facetOf<AgentConnectorRuntime>({ registry: CONNECTOR_RUNTIMES, id }),
    wake: facetOf<AgentWakeTarget>({ registry: WAKE_TARGETS, id }),
    channel: facetOf<AgentChannelProtocol>({ registry: CHANNEL_PROTOCOLS, id }),
  };
}

export function leakLiteralsOf(input: Facets): string[] {
  const { runtime, wake, channel } = input;
  return [
    ...(runtime === null ? [] : [runtime.homeFolder, runtime.homeVariable]),
    ...(wake === null ? [] : [wake.host, wake.providerId]),
    ...(channel === null ? [] : [channel.capability, channel.notificationMethod]),
  ];
}

export function registeredLeakAgents(): LeakAgent[] {
  return Object.entries(AGENT_DEFINITIONS).map(([id, definition]: [string, AgentDefinition]) => ({
    id,
    enumMember: definition.enumMember,
    isOrdinaryWord: definition.idIsOrdinaryWord,
    literals: leakLiteralsOf(facetsOf({ id })),
  }));
}
