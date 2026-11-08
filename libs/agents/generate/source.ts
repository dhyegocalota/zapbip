import { spawnSync } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { REPOSITORY_ROOT, repositoryPath } from './repository';

export function readSource(path: string): string {
  return readFileSync(repositoryPath(path), 'utf8');
}

export function listSource(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory)).sort();
}

const LISTING_MAX_BUFFER = 64 * 1024 * 1024;
const ENTRY_SEPARATOR = '\u0000';
const SYMBOLIC_LINK_MODE = '120000';
const LISTING_PATH_SEPARATOR = '\t';
const BINARY_MARKER = '\u0000';

export class UnreadableTrackedFileError extends Error {
  constructor(input: { path: string; code: string }) {
    super(`${input.path}: cannot be read (${input.code})`);
  }
}

function textOf({ root, path }: { root: string; path: string }): string {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch (error) {
    throw new UnreadableTrackedFileError({ path, code: (error as NodeJS.ErrnoException).code as string });
  }
}

function listingOf({ root, flags }: { root: string; flags: string[] }): string[] {
  const listing = spawnSync('git', ['ls-files', '-z', ...flags], { cwd: root, encoding: 'utf8', maxBuffer: LISTING_MAX_BUFFER });
  if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
  return listing.stdout.split(ENTRY_SEPARATOR).filter((entry) => entry);
}

export function trackedTextFiles({ root = REPOSITORY_ROOT }: { root?: string } = {}): { path: string; text: string }[] {
  const deletedPaths = listingOf({ root, flags: ['--deleted'] });
  return listingOf({ root, flags: ['--stage'] })
    .map((entry) => ({ mode: entry.split(' ')[0], path: entry.slice(entry.indexOf(LISTING_PATH_SEPARATOR) + 1) }))
    .filter((entry) => entry.mode !== SYMBOLIC_LINK_MODE && !deletedPaths.includes(entry.path))
    .map((entry) => ({ path: entry.path, text: textOf({ root, path: entry.path }) }))
    .filter((file) => !file.text.includes(BINARY_MARKER));
}

export function listTree(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posix.join(posix.relative(repositoryPath(directory), entry.parentPath), entry.name))
    .sort();
}
