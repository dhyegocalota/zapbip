import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const SUPPORTED_FOLDER = 'libs/agents/supported';

export function repositoryPath(path: string): string {
  return resolve(REPOSITORY_ROOT, path);
}
