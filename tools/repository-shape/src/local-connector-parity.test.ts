import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { DocsPageLanguage } from '@zapbip/types';
import { twinPathOf } from './docs-experience';
import { DOCS_ROOT, REPOSITORY_ROOT, readRepositoryFile } from './repository-files';

const BASELINE_REFERENCE = 'origin/main';
const PAGE = 'developers/local-connector';
const PAGE_EXTENSION = '.mdx';
const SECTION_HEADINGS: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'What the AI can do when woken',
  [DocsPageLanguage.PortugueseBrazil]: 'O que a IA pode fazer quando é acordada',
  [DocsPageLanguage.Spanish]: 'Qué puede hacer la IA cuando la despiertan',
  [DocsPageLanguage.German]: 'Was die KI tun kann, wenn sie geweckt wird',
  [DocsPageLanguage.French]: "Ce que l'IA peut faire quand on la réveille",
  [DocsPageLanguage.Japanese]: 'AI が起こされたときにできること',
  [DocsPageLanguage.Korean]: 'AI가 깨어났을 때 할 수 있는 일',
  [DocsPageLanguage.Chinese]: '唤醒后 AI 能做什么',
};
const BASELINE_LANGUAGES = [DocsPageLanguage.English, DocsPageLanguage.PortugueseBrazil];
const NEW_LANGUAGES = Object.values(DocsPageLanguage).filter((language) => !BASELINE_LANGUAGES.includes(language));
const CODE_SPAN_PATTERN = /`[^`\n]+`/g;

function pagePathOf(input: { language: DocsPageLanguage }): string {
  return `${DOCS_ROOT}/${twinPathOf({ path: PAGE, language: input.language })}${PAGE_EXTENSION}`;
}

function sectionPatternOf(input: { language: DocsPageLanguage }): RegExp {
  return new RegExp(`^## ${SECTION_HEADINGS[input.language]}[\\s\\S]*?(?=^## )`, 'm');
}

function sectionOf(input: { language: DocsPageLanguage; markdown: string }): string {
  const section = sectionPatternOf({ language: input.language }).exec(input.markdown)?.[0];
  if (section === undefined) throw new Error(`no wake isolation section in ${input.language}`);
  return section;
}

function baselinePage(input: { path: string }): string {
  const shown = spawnSync('git', ['show', `${BASELINE_REFERENCE}:${input.path}`], { cwd: REPOSITORY_ROOT, encoding: 'utf8' });
  if (shown.status !== 0) throw new Error(`git show failed: ${shown.stderr}`);
  return shown.stdout;
}

describe('the local connector page keeps the text of the baseline', () => {
  test.each(BASELINE_LANGUAGES)('the wake isolation section in %s reads word for word as on the baseline, in its order', (language) => {
    const path = pagePathOf({ language });
    const current = sectionOf({ language, markdown: readRepositoryFile(path) });
    const baseline = sectionOf({ language, markdown: baselinePage({ path }) });
    expect(current).toBe(baseline);
  });

  test.each(NEW_LANGUAGES)('the wake isolation section in %s names the same commands and files as the English one', (language) => {
    const english = sectionOf({
      language: DocsPageLanguage.English,
      markdown: readRepositoryFile(pagePathOf({ language: DocsPageLanguage.English })),
    });
    const translated = sectionOf({ language, markdown: readRepositoryFile(pagePathOf({ language })) });
    expect([...translated.matchAll(CODE_SPAN_PATTERN)].map((match) => match[0]).sort()).toEqual(
      [...english.matchAll(CODE_SPAN_PATTERN)].map((match) => match[0]).sort(),
    );
  });

  test.each(Object.values(DocsPageLanguage))('the page in %s imports no generated snippet', (language) => {
    expect(readRepositoryFile(pagePathOf({ language }))).not.toContain('/snippets/');
  });
});
