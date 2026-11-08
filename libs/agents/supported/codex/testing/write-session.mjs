import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SESSIONS_FOLDER = 'sessions';
const MILLISECONDS_PER_SECOND = 1000;
const DATE_LENGTH = 10;

export async function writeSession(input) {
  const timestamp = new Date(input.modifiedAtSeconds * MILLISECONDS_PER_SECOND).toISOString();
  const [year, month, dayOfMonth] = timestamp.slice(0, DATE_LENGTH).split('-');
  const directory = join(input.homeDirectory, SESSIONS_FOLDER, year, month, dayOfMonth);
  const file = join(directory, `rollout-${timestamp.replaceAll(':', '-').slice(0, 19)}-${input.sessionId}.jsonl`);
  await mkdir(directory, { recursive: true });
  await writeFile(file, `${JSON.stringify({ type: 'session_meta', payload: { id: input.sessionId, cwd: input.workingDirectory } })}\n`);
  await utimes(file, input.modifiedAtSeconds, input.modifiedAtSeconds);
}
