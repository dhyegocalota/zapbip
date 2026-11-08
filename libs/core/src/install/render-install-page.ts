import type { OwnerLocale } from '@zapbip/types';
import { AGENT_RULES } from '../agent-rules';
import { INSTALL_PAGE_COPY } from './install-page-copy';
import type { InstallPageSection } from './prompts/install-section';

export type InstallPageInput = {
  agent: string;
  connectionLink: string;
  locale: OwnerLocale;
  standbyAgent: string | null;
  sections: InstallPageSection[];
};

export function renderInstallPage(input: InstallPageInput): string {
  const texts = INSTALL_PAGE_COPY[input.locale];
  const productNames = input.sections.map((section) => section.productName).join(', ');
  const renderedSections = input.sections.map((section) => section.render(input));
  return [
    `# zapbip install for ${input.agent}`,
    `You are an AI agent. The owner asked you to connect to their WhatsApp through zapbip. Do the steps in order and run only the section of your own product. The connection address in this page is a secret: never repeat it to anyone but the owner. Tell the owner never to paste the connection address into any other chat or app. Reply to the owner in ${texts.ownerLanguage}. Before you change a file or a setting, say which one and wait for a yes. Stop at the first failed step, name it and send nothing else.`,
    '## Identify your product',
    `Find which product you run in: ${productNames}. If none matches, stop and tell the owner: "${texts.unsupportedProduct}"`,
    '## Rules you follow after install',
    AGENT_RULES,
    ...renderedSections,
    texts.footer,
  ].join('\n\n');
}
