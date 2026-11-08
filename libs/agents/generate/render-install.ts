import { OwnerLocale } from '@zapbip/types';
import { installAgentsOf, type ResolvedAgent } from './agent';
import { camelCaseOf } from './identifiers';
import { renderRegistry } from './render-registry';
import type { GeneratedFile } from './plan';

const SAMPLE_CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
const SAMPLE_STANDBY_AGENT = 'Ana Bot';

export function renderInstallRegistry(input: { agents: ResolvedAgent[] }): string {
  const installAgents = installAgentsOf({ agents: input.agents });
  const installOrder = installAgents.map((agent) => `${camelCaseOf({ id: agent.id })}AgentInstall`).join(', ');
  return renderRegistry({
    spec: {
      agents: installAgents,
      exportedName: 'AGENT_INSTALLS',
      moduleFile: 'install',
      moduleExport: 'install',
      enumName: 'InstallClient',
      valueType: 'AgentInstall',
      contractType: 'AgentInstall',
      extraImports: ["import type { InstallSection } from '@zapbip/core';"],
      extraSource: [
        `const INSTALL_ORDER: AgentInstall[] = [${installOrder}];`,
        'export const INSTALL_PAGE_SECTIONS: { productName: string; render: InstallSection }[] = INSTALL_ORDER.map((install) => ({',
        '  productName: install.productName,',
        '  render: install.render,',
        '}));',
      ],
    },
  });
}

export function planInstallSections(input: { agents: ResolvedAgent[] }): GeneratedFile[] {
  return installAgentsOf({ agents: input.agents }).flatMap((agent) =>
    Object.values(OwnerLocale).flatMap((locale) => {
      const plain = agent.install.render({ connectionLink: SAMPLE_CONNECTION_LINK, locale, standbyAgent: null });
      const withStandby = agent.install.render({ connectionLink: SAMPLE_CONNECTION_LINK, locale, standbyAgent: SAMPLE_STANDBY_AGENT });
      const standbyFiles = withStandby === plain ? [] : [{ path: `${agent.folder}/install.standby.${locale}.md`, content: withStandby }];
      return [{ path: `${agent.folder}/install.${locale}.md`, content: plain }, ...standbyFiles];
    }),
  );
}
