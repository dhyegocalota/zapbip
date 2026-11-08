import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SESSIONS_FOLDER = 'sessions';

export async function writeSession(input) {
  const folder = join(input.homeDirectory, SESSIONS_FOLDER);
  const file = join(folder, input.sessionId);
  await mkdir(folder, { recursive: true });
  await writeFile(file, '');
  await utimes(file, input.modifiedAtSeconds, input.modifiedAtSeconds);
}
