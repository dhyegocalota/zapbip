import { access, lutimes, mkdir, mkdtemp, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONNECTOR_KILL_GRACE_MS, CONNECTOR_WAKE_TIMEOUT_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { removeStaleWakeDirectories } from '../../src/wake-isolation';

let rootDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-isolation-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

describe('removeStaleWakeDirectories', () => {
  const STALE_AGE_MS = CONNECTOR_WAKE_TIMEOUT_MS + CONNECTOR_KILL_GRACE_MS;
  let originalTemporaryDirectory: string | undefined;

  async function makeWakeDirectory(input: { name: string; ageMs: number }): Promise<string> {
    const directory = join(rootDirectory, input.name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'mcp.json'), '{}');
    const modifiedAtSeconds = (Date.now() - input.ageMs) / 1000;
    await utimes(directory, modifiedAtSeconds, modifiedAtSeconds);
    return directory;
  }

  beforeEach(() => {
    originalTemporaryDirectory = process.env.TMPDIR;
    process.env.TMPDIR = rootDirectory;
  });

  afterEach(() => {
    if (originalTemporaryDirectory === undefined) delete process.env.TMPDIR;
    if (originalTemporaryDirectory !== undefined) process.env.TMPDIR = originalTemporaryDirectory;
  });

  test('removes a leftover wake folder older than a wake can run', async () => {
    const leftover = await makeWakeDirectory({ name: 'zapbip-wake-old', ageMs: STALE_AGE_MS + 60_000 });
    await removeStaleWakeDirectories();
    await expect(access(leftover)).rejects.toThrow();
  });

  test('survives another connector removing the same folders at the same time', async () => {
    const leftovers = await Promise.all(
      Array.from({ length: 30 }, (_, index) => makeWakeDirectory({ name: `zapbip-wake-race-${index}`, ageMs: STALE_AGE_MS + 60_000 })),
    );
    await Promise.all([removeStaleWakeDirectories(), removeStaleWakeDirectories()]);
    await Promise.all(leftovers.map((leftover) => expect(access(leftover)).rejects.toThrow()));
  });

  test('never removes a wake folder owned by another user', async () => {
    const foreign = await makeWakeDirectory({ name: 'zapbip-wake-foreign', ageMs: STALE_AGE_MS + 60_000 });
    const ownerId = (await stat(foreign)).uid;
    await removeStaleWakeDirectories({ userId: ownerId + 1 });
    await expect(access(foreign)).resolves.toBeUndefined();
  });

  test('never follows or removes a symlink named like a wake folder', async () => {
    const target = await makeWakeDirectory({ name: 'precious', ageMs: STALE_AGE_MS + 60_000 });
    const link = join(rootDirectory, 'zapbip-wake-link');
    await symlink(target, link);
    await lutimes(link, 1, 1);
    await removeStaleWakeDirectories();
    await expect(access(link)).resolves.toBeUndefined();
    await expect(access(join(target, 'mcp.json'))).resolves.toBeUndefined();
  });

  test('keeps a wake folder a running wake may still use', async () => {
    const running = await makeWakeDirectory({ name: 'zapbip-wake-running', ageMs: 1_000 });
    await removeStaleWakeDirectories();
    await expect(access(running)).resolves.toBeUndefined();
  });

  test('keeps folders that are not wake folders', async () => {
    const other = await makeWakeDirectory({ name: 'someone-elses', ageMs: STALE_AGE_MS + 60_000 });
    await removeStaleWakeDirectories();
    await expect(access(other)).resolves.toBeUndefined();
  });
});
