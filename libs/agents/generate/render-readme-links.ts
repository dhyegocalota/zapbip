import { posix } from 'node:path';
import type { GeneratedFile } from './plan';

export const README_LINK_FILES = ['README.md', 'apps/README.md'];

const TABLE_ROW_PREFIX = '|';
const FOLDER_LINK_PATTERN = /\]\(([^)\s]+\/)\)/;

function isDanglingRow(input: { line: string; directory: string; listSource: (directory: string) => string[] }): boolean {
  if (!input.line.startsWith(TABLE_ROW_PREFIX)) return false;
  const target = FOLDER_LINK_PATTERN.exec(input.line)?.[1];
  if (target === undefined) return false;
  const folder = posix.join(input.directory, target);
  return !input.listSource(posix.dirname(folder)).includes(posix.basename(folder));
}

export function prunedReadmeOf(input: { path: string; source: string; listSource: (directory: string) => string[] }): GeneratedFile {
  const directory = posix.dirname(input.path) === '.' ? '' : posix.dirname(input.path);
  const lines = input.source.split('\n').filter((line) => !isDanglingRow({ line, directory, listSource: input.listSource }));
  return { path: input.path, content: lines.join('\n') };
}

export function renderReadmeLinks(input: {
  readSource: (path: string) => string;
  listSource: (directory: string) => string[];
}): GeneratedFile[] {
  return README_LINK_FILES.flatMap((path) => {
    const source = input.readSource(path);
    const pruned = prunedReadmeOf({ path, source, listSource: input.listSource });
    return pruned.content === source ? [] : [pruned];
  });
}
