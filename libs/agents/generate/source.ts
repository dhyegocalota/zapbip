import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { repositoryPath } from './repository';

export function readSource(path: string): string {
  return readFileSync(repositoryPath(path), 'utf8');
}

export function listSource(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory)).sort();
}
