import { readdir } from 'node:fs/promises';
import { isMissingEntry } from './missing-entry';

export async function listDirectory(input: { directory: string; recursive: boolean }): Promise<string[]> {
  try {
    return await readdir(input.directory, { recursive: input.recursive });
  } catch (error) {
    if (isMissingEntry({ error })) return [];
    throw error;
  }
}
