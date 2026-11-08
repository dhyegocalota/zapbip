import { DocsLanguage } from '@zapbip/types';
import { connectorViolationsOf } from '../src/checks/connectors';
import { guideParityViolationsOf } from '../src/checks/guide-parity';
import { installSectionViolationsOf } from '../src/checks/install-sections';
import type { LeakFile } from '../src/checks/leaks';
import { pluginViolationsOf, type PluginCheckSources } from '../src/checks/plugins';
import { treeBoundaryViolationsOf, treeLeakViolationsOf } from './leak-scan';
import type { LoadedAgent } from './load';

export type CheckedAgent = LoadedAgent & { guides: Record<DocsLanguage, string> };

export function registryCheckViolationsOf(input: { agents: CheckedAgent[]; files: LeakFile[]; sources: PluginCheckSources }): string[] {
  const withDefinition = input.agents.flatMap((agent) => (agent.definition === null ? [] : [{ ...agent, definition: agent.definition }]));
  const installSections = withDefinition.flatMap((agent) =>
    agent.install === null ? [] : [{ id: agent.id, install: agent.install, definition: agent.definition }],
  );
  const guideEntries = withDefinition.flatMap((agent) =>
    agent.install === null ? [] : [{ id: agent.id, install: agent.install, isPluginPage: agent.plugin !== null, guides: agent.guides }],
  );
  const connectorEntries = withDefinition.flatMap((agent) => (agent.runtime === null ? [] : [{ id: agent.id, runtime: agent.runtime }]));
  const pluginEntries = withDefinition.flatMap((agent) => (agent.plugin === null ? [] : [{ id: agent.id, plugin: agent.plugin }]));
  const scannedAgents = withDefinition.map((agent) => ({ id: agent.id, definition: agent.definition, runtime: agent.runtime }));
  return [
    ...installSectionViolationsOf({ entries: installSections }),
    ...guideParityViolationsOf({ entries: guideEntries }),
    ...connectorViolationsOf({ entries: connectorEntries }),
    ...pluginViolationsOf({ entries: pluginEntries, sources: input.sources }),
    ...treeLeakViolationsOf({ agents: scannedAgents, files: input.files }),
    ...treeBoundaryViolationsOf({ files: input.files }),
  ];
}
