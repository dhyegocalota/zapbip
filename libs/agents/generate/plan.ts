import { posix } from 'node:path';
import { DocsLanguage } from '@zapbip/types';
import { hasValidAgentId, registryViolationsOf } from '../src/checks/registry';
import type { ResolvedAgent } from './agent';
import type { DiscoveredAgent } from './discover';
import { formatted } from './format';
import { loadAgent, registryEntriesOf, type LoadedAgent } from './load';
import { DOCS_CONFIG, GENERATED_FOLDER, MATRIX_SNIPPETS, PAGE_DIRECTORIES, WORKFLOW_FILE } from './paths';
import { renderConnectorRegistry } from './render-connector';
import { renderDefinitions } from './render-definitions';
import { renderIds } from './render-ids';
import { planInstallSections, renderInstallRegistry } from './render-install';
import { renderMatrix } from './render-matrix';
import { orphanPagePathsOf, renderNavigation } from './render-navigation';
import { planPages } from './render-pages';
import { renderPluginRegistry } from './render-plugins';
import { renderWorkflow } from './render-workflow';

export type GeneratedFile = { path: string; content: string };
export type GenerationPlan = { writes: GeneratedFile[]; deletions: string[]; violations: string[] };

type PlanInput = {
  agents: DiscoveredAgent[];
  readSource: (path: string) => string;
  listSource: (directory: string) => string[];
};

function resolvedAgentsOf(input: { loaded: LoadedAgent[] }): ResolvedAgent[] {
  return input.loaded.flatMap((agent) =>
    agent.definition !== null && hasValidAgentId({ id: agent.id }) ? [{ ...agent, definition: agent.definition }] : [],
  );
}

function existingPagePathsOf(input: { listSource: (directory: string) => string[] }): string[] {
  return Object.values(PAGE_DIRECTORIES).flatMap((directory) => input.listSource(directory).map((name) => posix.join(directory, name)));
}

function generatedModules(input: { agents: ResolvedAgent[] }): GeneratedFile[] {
  return [
    { path: `${GENERATED_FOLDER}/ids.ts`, content: renderIds(input) },
    { path: `${GENERATED_FOLDER}/definitions.ts`, content: renderDefinitions(input) },
    { path: `${GENERATED_FOLDER}/install.ts`, content: renderInstallRegistry(input) },
    { path: `${GENERATED_FOLDER}/connector.ts`, content: renderConnectorRegistry(input) },
    { path: `${GENERATED_FOLDER}/plugins.ts`, content: renderPluginRegistry(input) },
  ];
}

function matrixSnippets(input: { agents: ResolvedAgent[] }): GeneratedFile[] {
  return Object.values(DocsLanguage).map((language) => ({
    path: MATRIX_SNIPPETS[language],
    content: renderMatrix({ agents: input.agents, language }),
  }));
}

export async function planGeneratedFiles(input: PlanInput): Promise<GenerationPlan> {
  const loaded = await Promise.all(input.agents.map((agent) => loadAgent({ agent })));
  const agents = resolvedAgentsOf({ loaded });
  const pages = planPages({ agents, readSource: input.readSource });
  const navigation = renderNavigation({ source: input.readSource(DOCS_CONFIG), agents });
  const navigationWrites = navigation.violations.length === 0 ? [{ path: DOCS_CONFIG, content: navigation.content }] : [];
  const writes = [
    ...generatedModules({ agents }),
    ...planInstallSections({ agents }),
    ...pages.writes,
    ...matrixSnippets({ agents }),
    ...navigationWrites,
    { path: WORKFLOW_FILE, content: renderWorkflow({ source: input.readSource(WORKFLOW_FILE), agents }) },
  ];
  const formattedWrites = await Promise.all(writes.map(async (write) => ({ path: write.path, content: await formatted(write) })));
  return {
    writes: formattedWrites.sort((left, right) => left.path.localeCompare(right.path)),
    deletions: orphanPagePathsOf({
      existingPaths: existingPagePathsOf({ listSource: input.listSource }),
      agentIds: input.agents.map((agent) => agent.id),
    }),
    violations: [
      ...registryViolationsOf({ entries: registryEntriesOf({ agents: loaded }) }),
      ...pages.violations,
      ...navigation.violations,
    ],
  };
}
