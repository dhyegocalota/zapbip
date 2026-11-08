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

export function trackedTextFiles({ root = REPOSITORY_ROOT }: { root?: string } = {}): { path: string; text: string }[] {
  const listing = spawnSync('git', ['ls-files', '-z', '--stage'], { cwd: root, encoding: 'utf8', maxBuffer: LISTING_MAX_BUFFER });
  if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
  return listing.stdout
    .split(ENTRY_SEPARATOR)
    .filter((entry) => entry)
    .map((entry) => ({ mode: entry.split(' ')[0], path: entry.slice(entry.indexOf(LISTING_PATH_SEPARATOR) + 1) }))
    .filter((entry) => entry.mode !== SYMBOLIC_LINK_MODE)
    .map((entry) => ({ path: entry.path, text: readFileSync(resolve(root, entry.path), 'utf8') }))
    .filter((file) => !file.text.includes(BINARY_MARKER));
}

export function listTree(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posix.join(posix.relative(repositoryPath(directory), entry.parentPath), entry.name))
    .sort();
}
