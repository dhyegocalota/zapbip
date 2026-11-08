import type { GeneratedFile } from './plan';

export function scaffoldFilesOf(input: {
  id: string;
  existingIds: string[];
  readSource: (path: string) => string;
  listSource: (directory: string) => string[];
}): GeneratedFile[] {
  throw new Error(`scaffoldFilesOf is not implemented for ${input.id}`);
}
