import { DocsLanguage } from '@zapbip/types';

export const GENERATED_FOLDER = 'libs/agents/src/generated';
export const DOCS_CONFIG = 'apps/docs/docs.json';
export const DOCS_PAGES_ROOT = 'apps/docs';

export const PAGE_DIRECTORIES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'apps/docs/agents',
  [DocsLanguage.PortugueseBrazil]: 'apps/docs/pt-br/agents',
};

export const MATRIX_SNIPPETS: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'apps/docs/snippets/agents/matrix.mdx',
  [DocsLanguage.PortugueseBrazil]: 'apps/docs/snippets/pt-br/agents/matrix.mdx',
};

export const CONNECTOR_SNIPPETS: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'apps/docs/snippets/agents/connector-clients.mdx',
  [DocsLanguage.PortugueseBrazil]: 'apps/docs/snippets/pt-br/agents/connector-clients.mdx',
};

export const CONNECTOR_PARAGRAPH_FILES: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'connector.en.mdx',
  [DocsLanguage.PortugueseBrazil]: 'connector.pt-br.mdx',
};
