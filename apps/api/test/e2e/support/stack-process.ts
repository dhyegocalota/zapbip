import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { SECOND_MS } from '@zapbip/types';
import { HEALTH_PATH } from '../../../src/contract/constants';

export const LOOPBACK_HOST = '127.0.0.1';
export const HEALTH_TIMEOUT_MS = 30 * SECOND_MS;
const HEALTH_POLL_INTERVAL_MS = 250;

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') return reject(new Error('no port assigned'));
      server.close(() => resolve(address.port));
    });
  });
}

export async function waitForHealth(input: { origin: string; server: ChildProcess; deadline: number }): Promise<void> {
  const response = await fetch(`${input.origin}${HEALTH_PATH}`).catch(() => null);
  if (response?.ok) return;
  if (input.server.exitCode !== null) throw new Error(`wrangler dev exited with ${input.server.exitCode}`);
  if (Date.now() > input.deadline) throw new Error(`wrangler dev did not answer ${HEALTH_PATH} within ${HEALTH_TIMEOUT_MS} ms`);
  await delay(HEALTH_POLL_INTERVAL_MS);
  return waitForHealth(input);
}
