import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readmes, readRepositoryFile, repositoryPath, workspacePackages } from './repository-files';

const README_FILE = 'README.md';
const HARNESS_FILE = '.claude/HARNESS.md';
const ROOT_ENTRIES = [
  '.agents',
  '.claude',
  '.codex',
  '.github',
  '.gitignore',
  '.gitleaks.toml',
  '.mcp.json',
  '.npmrc',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'README.md',
  'docs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts',
  'tools',
  'tsconfig.base.json',
];
const FEATURE_PACKAGES = ['libs/types', 'libs/core', 'apps/api', 'apps/docs'];
const NESTED_PATH_PATTERN = /\/.*$/;
const TEMPORARY_SEGMENT_PATTERN =
  /(^|\/)(spikes?|poc|prototypes?|experiments?|scratch|scratchpad|playground|sandbox|tmp|temp|wip|backups?)(\/|$)/i;
const LINK_PATTERN = /\]\(([^)\s]+)\)/g;
const HEADING_PATTERN = /^#{1,6} (.+)$/gm;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const SLUG_DISALLOWED_PATTERN = /[^a-z0-9 -]/g;
const SPACE_PATTERN = / /g;
const EXTERNAL_LINK_PATTERN = /^(https?:|mailto:|#)/;
const ANCHOR_SEPARATOR = '#';
const MARKDOWN_EXTENSION = '.md';

function slugOf(heading: string): string {
  return heading.toLowerCase().replace(SLUG_DISALLOWED_PATTERN, '').replace(SPACE_PATTERN, '-');
}

function headingSlugs(path: string): string[] {
  return capturedNames({ text: readRepositoryFile(path).replace(FENCED_BLOCK_PATTERN, ''), pattern: HEADING_PATTERN }).map(slugOf);
}

function isBroken({ document, target }: { document: string; target: string }): boolean {
  const path = target.split(ANCHOR_SEPARATOR, 1).join('');
  const anchor = target.slice(path.length + ANCHOR_SEPARATOR.length);
  const targetPath = posix.join(posix.dirname(document), path);
  if (!existsSync(repositoryPath(targetPath))) return true;
  if (!anchor) return false;
  if (!targetPath.endsWith(MARKDOWN_EXTENSION)) return false;
  return !headingSlugs(targetPath).includes(anchor);
}

function brokenTargets({ document, text }: { document: string; text: string }): string[] {
  const prose = text.replace(FENCED_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '');
  return capturedNames({ text: prose, pattern: LINK_PATTERN })
    .filter((target) => !EXTERNAL_LINK_PATTERN.test(target))
    .filter((target) => isBroken({ document, target }));
}

const LINKED_DOCUMENTS = readmes();

function repositoryFiles(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repositoryPath('.'),
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path.length > 0)
    .filter((path) => existsSync(repositoryPath(path)));
}

describe('delivery documents', () => {
  test.each(LINKED_DOCUMENTS)('every relative link in %s points at a file and a heading in the repository', (document) => {
    expect(brokenTargets({ document, text: readRepositoryFile(document) })).toEqual([]);
  });

  test('a link to a heading its target does not have is reported', () => {
    const text = `[missing](${HARNESS_FILE}#no-such-heading) [present](${HARNESS_FILE}#4-build)`;
    expect(brokenTargets({ document: README_FILE, text })).toEqual([`${HARNESS_FILE}#no-such-heading`]);
  });

  test('a link written as inline code or inside a fenced block is not checked', () => {
    const text = '`[NNNN](NNNN-slug.md)`\n```\n[missing](no-such-file.md)\n```\n[broken](no-such-file.md)';
    expect(brokenTargets({ document: README_FILE, text })).toEqual(['no-such-file.md']);
  });

  test('every workspace package has a README', () => {
    expect(workspacePackages().filter((path) => !existsSync(repositoryPath(posix.join(path, README_FILE))))).toEqual([]);
  });

  test.each(FEATURE_PACKAGES)('the %s package has a README', (path) => {
    expect(existsSync(repositoryPath(posix.join(path, README_FILE)))).toBe(true);
  });

  test('the root holds only the entries the layout names', () => {
    const rootEntries = new Set(repositoryFiles().map((path) => path.replace(NESTED_PATH_PATTERN, '')));
    expect([...rootEntries].filter((entry) => !ROOT_ENTRIES.includes(entry))).toEqual([]);
  });

  test('no path carries a folder an agent leaves behind for temporary work', () => {
    expect(repositoryFiles().filter((path) => TEMPORARY_SEGMENT_PATTERN.test(path))).toEqual([]);
  });
});
