import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { SECOND_MS } from '@zapbip/types';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';
import { HEALTH_PATH } from '../../../src/contract/constants';
import { startFakeGraph } from '../../support/fake-graph';
import type { StackContext } from '../global-setup';
import { ACCESS_TOKEN, APP_SECRET, FAKE_GRAPH_PORT, OWNER_PHONE, PHONE_NUMBER_ID, SEED_AGENTS, VERIFY_TOKEN } from './constants';

const runCommand = promisify(execFile);
const HEALTH_TIMEOUT_MS = 30 * SECOND_MS;
const HEALTH_POLL_INTERVAL_MS = 250;
const SIGNING_KEY_BYTES = 32;
const LOOPBACK_HOST = '127.0.0.1';
const DATABASE_BINDING = 'CONNECTIONS';
const LOG_FILE_NAME = 'wrangler-dev.log';

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });

function freePort(): Promise<number> {
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

async function waitForHealth(input: { origin: string; server: ChildProcess; deadline: number }): Promise<void> {
  const response = await fetch(`${input.origin}${HEALTH_PATH}`).catch(() => null);
  if (response?.ok) return;
  if (input.server.exitCode !== null) throw new Error(`wrangler dev exited with ${input.server.exitCode}`);
  if (Date.now() > input.deadline) throw new Error(`wrangler dev did not answer ${HEALTH_PATH} within ${HEALTH_TIMEOUT_MS} ms`);
  await delay(HEALTH_POLL_INTERVAL_MS);
  return waitForHealth(input);
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const fakeGraph = await startFakeGraph({ port: FAKE_GRAPH_PORT });
  const persistDirectory = await mkdtemp(join(tmpdir(), 'zapbip-e2e-whatsapp-'));
  const port = await freePort();
  const origin = `http://${LOOPBACK_HOST}:${port}`;
  const persistArguments = ['--persist-to', persistDirectory];

  await runCommand('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', DATABASE_BINDING, '--local', ...persistArguments]);
  const seeded = await runCommand('pnpm', [
    'exec',
    'tsx',
    'scripts/dev-seed.ts',
    '--phone',
    OWNER_PHONE,
    '--agents',
    SEED_AGENTS.join(','),
    '--json',
    ...persistArguments,
  ]);
  const { connections } = seedOutputSchema.parse(JSON.parse(seeded.stdout));

  const variables = {
    MEDIA_LINK_SIGNING_KEY: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
    UPLOAD_LINK_SIGNING_KEY: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
    PUBLIC_ORIGIN: origin,
    META_APP_SECRET: APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
    WHATSAPP_ACCESS_TOKEN: ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
    WHATSAPP_GRAPH_BASE_URL: `http://${LOOPBACK_HOST}:${FAKE_GRAPH_PORT}`,
  };
  const server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--ip',
      LOOPBACK_HOST,
      '--port',
      String(port),
      ...persistArguments,
      ...Object.entries(variables).flatMap(([name, value]) => ['--var', `${name}:${value}`]),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  const logFile = join(persistDirectory, LOG_FILE_NAME);
  const logStream = createWriteStream(logFile);
  server.stdout.pipe(logStream);
  server.stderr.pipe(logStream);
  await waitForHealth({ origin, server, deadline: Date.now() + HEALTH_TIMEOUT_MS });

  const context: StackContext = {
    origin,
    phone: OWNER_PHONE,
    secrets: Object.fromEntries(connections.map((connection) => [connection.agent, connection.secret])),
    logFile,
  };
  project.provide('stack', context);

  return async () => {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
    logStream.end();
    await fakeGraph.stop();
    await rm(persistDirectory, { recursive: true, force: true });
  };
}
