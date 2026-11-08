import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { HEALTH_TIMEOUT_MS } from '../../../test/e2e/support/stack-process';
import { BackofficePath } from '../../../src/backoffice/backoffice-paths';

const POLL_INTERVAL_MS = 250;

export async function waitForSignIn(input: { origin: string; server: ChildProcess; deadline: number }): Promise<void> {
  const response = await fetch(`${input.origin}${BackofficePath.SignIn}`).catch(() => null);
  if (response?.ok) return;
  if (input.server.exitCode !== null) throw new Error(`wrangler dev exited with ${input.server.exitCode}`);
  if (Date.now() > input.deadline) throw new Error(`wrangler dev did not serve ${BackofficePath.SignIn} within ${HEALTH_TIMEOUT_MS} ms`);
  await delay(POLL_INTERVAL_MS);
  return waitForSignIn(input);
}
