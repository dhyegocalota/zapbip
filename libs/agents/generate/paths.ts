import { AGENTS_DIRECTORY, perLanguage, snippetPathOf, twinPathOf } from '../src/docs';

export const GENERATED_FOLDER = 'libs/agents/src/generated';
export const DOCS_CONFIG = 'apps/docs/docs.json';
export const DOCS_PAGES_ROOT = 'apps/docs';
const MATRIX_SNIPPET_NAME = 'agents/matrix.mdx';

export const PAGE_DIRECTORIES = perLanguage({
  valueOf: (language) => `${DOCS_PAGES_ROOT}/${twinPathOf({ path: AGENTS_DIRECTORY, language })}`,
});

export const MATRIX_SNIPPETS = perLanguage({
  valueOf: (language) => `${DOCS_PAGES_ROOT}/${snippetPathOf({ name: MATRIX_SNIPPET_NAME, language })}`,
});

export const WORKFLOW_FILE = '.github/workflows/verify.yml';
