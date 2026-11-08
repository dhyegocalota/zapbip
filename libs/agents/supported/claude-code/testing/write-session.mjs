import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECTS_FOLDER = 'projects';
const NON_ALPHANUMERIC_PATTERN = /[^A-Za-z0-9]/g;

export async function writeSession(input) {
  const folder = join(input.homeDirectory, PROJECTS_FOLDER, input.workingDirectory.replace(NON_ALPHANUMERIC_PATTERN, '-'));
  const file = join(folder, `${input.sessionId}.jsonl`);
  await mkdir(folder, { recursive: true });
  await writeFile(file, '{}\n');
  await utimes(file, input.modifiedAtSeconds, input.modifiedAtSeconds);
}
