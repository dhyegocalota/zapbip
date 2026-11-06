import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const RULES_DIRECTORY = '.claude/rules';
const MARKDOWN_EXTENSION = '.md';
const CITED_PATH_PATTERN = /(?<![\w/.-])((?:apps|libs|docs|e2e|tools|scripts)\/[\w./-]*[\w/])/g;
const TRAILING_PERIOD = /\.$/;

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
});
