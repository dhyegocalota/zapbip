import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const README_PATHSPEC = '*README.md';
const WORKSPACE_PACKAGE_PARENTS = ['apps', 'libs', 'tools'];
export const PACKAGE_MANIFEST = 'package.json';
const LISTING_MAX_BUFFER = 64 * 1024 * 1024;
const CONFLICT_MARKER_PATTERN = /^(<{7}|={7}|>{7})( |$)/;
const LINE_SEPARATOR = '\n';
export const DOCS_ROOT = 'apps/docs';
export const PAGE_EXTENSION = '.mdx';
const PAGE_DIRECTORY_MARKERS = ['node_modules'];

export function repositoryPath(path: string): string {
  return resolve(REPOSITORY_ROOT, path);
}

export function readRepositoryFile(path: string): string {
  return readFileSync(repositoryPath(path), 'utf8');
}

export function capturedNames({ text, pattern }: { text: string; pattern: RegExp }): string[] {
  return [...text.matchAll(pattern)].flatMap((match) => match.slice(1, 2));
}

export function readmes(): string[] {
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', README_PATHSPEC], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
  if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
  return listing.stdout.split(LINE_SEPARATOR).filter((path) => path && existsSync(repositoryPath(path)));
}

export function trackedFiles(): string[] {
  const listing = spawnSync('git', ['ls-files', '--cached'], { cwd: REPOSITORY_ROOT, encoding: 'utf8', maxBuffer: LISTING_MAX_BUFFER });
  if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
  return listing.stdout
    .split(LINE_SEPARATOR)
    .filter((path) => path && existsSync(repositoryPath(path)) && statSync(repositoryPath(path)).isFile());
}

export function conflictMarkerLines(text: string): number[] {
  return text.split(LINE_SEPARATOR).flatMap((line, index) => (CONFLICT_MARKER_PATTERN.test(line) ? [index + 1] : []));
}

export function workspacePackages(): string[] {
  return WORKSPACE_PACKAGE_PARENTS.filter((parent) => existsSync(repositoryPath(parent))).flatMap((parent) =>
    readdirSync(repositoryPath(parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => posix.join(parent, entry.name))
      .filter((path) => existsSync(repositoryPath(posix.join(path, PACKAGE_MANIFEST)))),
  );
}

export function documentFiles(directory: string): string[] {
  return readdirSync(repositoryPath(posix.join(DOCS_ROOT, directory)), { withFileTypes: true })
    .filter((entry) => !PAGE_DIRECTORY_MARKERS.includes(entry.name))
    .flatMap((entry) => {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) return documentFiles(path);
      return entry.name.endsWith(PAGE_EXTENSION) ? [path] : [];
    });
}
