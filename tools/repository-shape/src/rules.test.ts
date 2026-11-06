import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const RULES_DIRECTORY = '.claude/rules';
const MARKDOWN_EXTENSION = '.md';
const CITED_PATH_PATTERN = /(?<![\w/.-])((?:apps|libs|docs|e2e|tools|scripts)\/[\w./-]*[\w/])/g;
const TRAILING_PERIOD = /\.$/;
const PATHS_FRONT_MATTER_PATTERN = /^---\npaths:\n(?:\s+- ".+"\n)+---\n/;
const CITED_RULE_PATTERN = /\.claude\/rules\/[\w-]+\.md/g;
const CITING_DOCUMENTS = ['AGENTS.md', '.claude/HARNESS.md', '.agents/roles/reviewer.md'];
const TESTING_RULE = '.claude/rules/testing.md';
const TESTING_SECTION = '## What a useful test is';

function ruleFiles(): string[] {
  if (!existsSync(repositoryPath(RULES_DIRECTORY))) return [];
  return readdirSync(repositoryPath(RULES_DIRECTORY))
    .filter((name) => name.endsWith(MARKDOWN_EXTENSION))
    .map((name) => posix.join(RULES_DIRECTORY, name));
}

describe('the rules', () => {
  test('cite only paths that exist', () => {
    const missing = ruleFiles().flatMap((rule) =>
      [...readRepositoryFile(rule).matchAll(CITED_PATH_PATTERN)]
        .map(([, path]) => path!.replace(TRAILING_PERIOD, ''))
        .filter((path) => !existsSync(repositoryPath(path)))
        .map((path) => `${rule}: ${path}`),
    );
    expect(missing).toEqual([]);
  });

  test('open with the paths front matter the harness loads them by', () => {
    const withoutFrontMatter = ruleFiles().filter((rule) => !PATHS_FRONT_MATTER_PATTERN.test(readRepositoryFile(rule)));
    expect(withoutFrontMatter).toEqual([]);
  });

  test('exist for every rule the harness documents cite', () => {
    const missing = CITING_DOCUMENTS.flatMap((document) =>
      [...readRepositoryFile(document).matchAll(CITED_RULE_PATTERN)]
        .map(([rule]) => rule)
        .filter((rule) => !existsSync(repositoryPath(rule)))
        .map((rule) => `${document}: ${rule}`),
    );
    expect(missing).toEqual([]);
  });

  test('state what a useful test is', () => {
    expect(readRepositoryFile(TESTING_RULE)).toContain(TESTING_SECTION);
  });
});
