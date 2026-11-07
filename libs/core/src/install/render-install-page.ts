import { InstallClient, type OwnerLocale } from '@zapbip/types';
import { AGENT_RULES } from '../agent-rules';
import { INSTALL_PAGE_COPY } from './install-page-copy';
import { INSTALL_PRODUCTS } from './install-products';
import { INSTALL_SECTIONS } from './prompts/index';

export type InstallPageInput = {
  agent: string;
  connectionLink: string;
  locale: OwnerLocale;
  standbyAgent: string | null;
};

const PRODUCT_NAMES = Object.values(InstallClient)
  .map((client) => INSTALL_PRODUCTS[client].name)
  .join(', ');

export function renderInstallPage(input: InstallPageInput): string {
  const texts = INSTALL_PAGE_COPY[input.locale];
  const sections = Object.values(InstallClient).map((client) => INSTALL_SECTIONS[client](input));
  return [
    `# zapbip install for ${input.agent}`,
    `You are an AI agent. The owner asked you to connect to their WhatsApp through zapbip. Do the steps in order and run only the section of your own product. The connection address in this page is a secret: never repeat it to anyone but the owner. Reply to the owner in ${texts.ownerLanguage}. Before you change a file or a setting, say which one and wait for a yes. Stop at the first failed step, name it and send nothing else.`,
    '## Identify your product',
    `Find which product you run in: ${PRODUCT_NAMES}. If none matches, stop and tell the owner: "${texts.unsupportedProduct}"`,
    '## Rules you follow after install',
    AGENT_RULES,
    ...sections,
    texts.footer,
  ].join('\n\n');
}
