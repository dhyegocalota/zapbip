import { DocsLanguage } from '@zapbip/types';
import { connectorAgentsOf, type ResolvedAgent } from './agent';
import { renderRegistry } from './render-registry';
import type { GeneratedFile } from './plan';
import { CONNECTOR_PARAGRAPH_FILES, CONNECTOR_SNIPPETS } from './paths';

const PARAGRAPH_SEPARATOR = '\n\n';

export function renderConnectorRegistry(input: { agents: ResolvedAgent[] }): string {
  return renderRegistry({
    spec: {
      agents: connectorAgentsOf({ agents: input.agents }),
      exportedName: 'CONNECTOR_RUNTIMES',
      moduleFile: 'connector',
      moduleExport: 'runtime',
      enumName: 'ConnectorClient',
      valueType: 'AgentConnectorRuntime',
      contractType: 'AgentConnectorRuntime',
      extraImports: [],
      extraSource: [],
    },
  });
}

function connectorParagraphFileOf(input: { language: DocsLanguage }): string {
  return CONNECTOR_PARAGRAPH_FILES[input.language];
}

export function planConnectorSnippets(input: {
  agents: ResolvedAgent[];
  readSource: (path: string) => string;
  listSource: (directory: string) => string[];
}): { writes: GeneratedFile[]; violations: string[] } {
  const connectorAgents = connectorAgentsOf({ agents: input.agents });
  if (connectorAgents.length === 0) return { writes: [], violations: [] };
  const missing = Object.values(DocsLanguage).flatMap((language) => {
    const file = connectorParagraphFileOf({ language });
    return connectorAgents
      .filter((agent) => !input.listSource(agent.folder).includes(file))
      .map((agent) => ({ message: `${agent.id} has no ${file}`, language }));
  });
  const missingLanguages = missing.map((entry) => entry.language);
  const writes = Object.values(DocsLanguage)
    .filter((language) => !missingLanguages.includes(language))
    .map((language) => ({
      path: CONNECTOR_SNIPPETS[language],
      content: `${connectorAgents
        .map((agent) => input.readSource(`${agent.folder}/${connectorParagraphFileOf({ language })}`).trim())
        .join(PARAGRAPH_SEPARATOR)}\n`,
    }));
  return { writes, violations: missing.map((entry) => entry.message) };
}
