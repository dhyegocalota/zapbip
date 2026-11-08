import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { REPOSITORY_ROOT, repositoryPath } from './repository';

export function readSource(path: string): string {
  return readFileSync(repositoryPath(path), 'utf8');
}

export function listSource(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory)).sort();
}

const LISTING_MAX_BUFFER = 64 * 1024 * 1024;
const LINE_SEPARATOR = '\n';
const BINARY_MARKER = '\u0000';

export function trackedTextFiles(): { path: string; text: string }[] {
  const listing = spawnSync('git', ['ls-files', '--cached'], { cwd: REPOSITORY_ROOT, encoding: 'utf8', maxBuffer: LISTING_MAX_BUFFER });
  if (listing.status !== 0) throw new Error(`git ls-files failed: ${listing.stderr}`);
  return listing.stdout
    .split(LINE_SEPARATOR)
    .filter((path) => path && existsSync(repositoryPath(path)) && statSync(repositoryPath(path)).isFile())
    .map((path) => ({ path, text: readFileSync(repositoryPath(path), 'utf8') }))
    .filter((file) => !file.text.includes(BINARY_MARKER));
}
