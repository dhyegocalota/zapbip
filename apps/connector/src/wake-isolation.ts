import type { Stats } from 'node:fs';
import { lstat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMissingEntry, WAKE_DIRECTORY_PREFIX } from '@zapbip/agents/connector';
import { CONNECTOR_KILL_GRACE_MS, CONNECTOR_WAKE_TIMEOUT_MS } from '@zapbip/types';

const STALE_WAKE_DIRECTORY_AGE_MS = CONNECTOR_WAKE_TIMEOUT_MS + CONNECTOR_KILL_GRACE_MS;

export async function removeStaleWakeDirectories(input: { nowMs?: number; userId?: number } = {}): Promise<void> {
  const { nowMs = Date.now(), userId = process.getuid?.() } = input;
  const temporaryDirectory = tmpdir();
  const names = (await readdir(temporaryDirectory)).filter((name) => name.startsWith(WAKE_DIRECTORY_PREFIX));
  await Promise.all(
    names.map(async (name) => {
      const directory = join(temporaryDirectory, name);
      const status = await statusOrNull({ directory });
      if (status === null) return;
      const isStaleOwnDirectory = status.isDirectory() && status.uid === userId && nowMs - status.mtimeMs > STALE_WAKE_DIRECTORY_AGE_MS;
      if (isStaleOwnDirectory) await rm(directory, { recursive: true, force: true });
    }),
  );
}

async function statusOrNull(input: { directory: string }): Promise<Stats | null> {
  try {
    return await lstat(input.directory);
  } catch (error) {
    if (isMissingEntry({ error })) return null;
    throw error;
  }
}
