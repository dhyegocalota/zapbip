import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { DocsLanguage, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { DOCS_ROOT, REPOSITORY_ROOT, readRepositoryFile } from './repository-files';

const BASELINE_REFERENCE = 'origin/main';
const PAGE = 'developers/local-connector.mdx';
const SECTION_PATTERNS: Record<DocsLanguage, RegExp> = {
  [DocsLanguage.English]: /^## What the AI can do when woken[\s\S]*?(?=^## )/m,
  [DocsLanguage.PortugueseBrazil]: /^## O que a IA pode fazer quando é acordada[\s\S]*?(?=^## )/m,
};
const PAGE_PATHS: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: `${DOCS_ROOT}/${PAGE}`,
  [DocsLanguage.PortugueseBrazil]: `${DOCS_ROOT}/${PAGE_LANGUAGE_FOLDER}/${PAGE}`,
};

function baselinePage(input: { path: string }): string {
  const shown = spawnSync('git', ['show', `${BASELINE_REFERENCE}:${input.path}`], { cwd: REPOSITORY_ROOT, encoding: 'utf8' });
  if (shown.status !== 0) throw new Error(`git show failed: ${shown.stderr}`);
  return shown.stdout;
}

describe('the local connector page keeps the text of the baseline', () => {
  test.each(Object.values(DocsLanguage))(
    'the wake isolation section in %s reads word for word as on the baseline, in its order',
    (language) => {
      const path = PAGE_PATHS[language];
      const current = SECTION_PATTERNS[language].exec(readRepositoryFile(path))?.[0];
      const baseline = SECTION_PATTERNS[language].exec(baselinePage({ path }))?.[0];
      expect(baseline).toBeDefined();
      expect(current).toBe(baseline);
    },
  );

  test.each(Object.values(DocsLanguage))('the page in %s imports no generated snippet', (language) => {
    expect(readRepositoryFile(PAGE_PATHS[language])).not.toContain('/snippets/');
  });
});
