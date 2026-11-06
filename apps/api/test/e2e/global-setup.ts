import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { WAKE_SECRET_KEY_BYTES } from '@zapbip/core';
import { SECOND_MS } from '@zapbip/types';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';
import { HEALTH_PATH } from '../../src/contract/constants';

const runCommand = promisify(execFile);
const HEALTH_TIMEOUT_MS = 30 * SECOND_MS;
const HEALTH_POLL_INTERVAL_MS = 250;
const SEED_PHONE = '5511999990000';
const SEED_AGENTS = ['alpha', 'beta'];
const WAKE_AGENT = 'grok';
const WAKE_ACCOUNT_PHONES = ['5511999990001', '5511999990002', '5511999990003', '5511999990004', '5511999990005'];
const SIGNING_KEY_BYTES = 32;
const LOOPBACK_HOST = '127.0.0.1';
const DATABASE_BINDING = 'CONNECTIONS';
const LOG_FILE_NAME = 'wrangler-dev.log';

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });

export type WakeAccount = { phone: string; agent: string; secret: string };

export type StackContext = {
  origin: string;
  phone: string;
  secrets: Record<string, string>;
  wakeAccounts: WakeAccount[];
  logFile: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    stack: StackContext;
  }
}

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

async function seedConnections(input: { phone: string; agents: string[]; persistArguments: string[] }) {
  const seeded = await runCommand('pnpm', [
    'exec',
    'tsx',
    'scripts/dev-seed.ts',
    '--phone',
    input.phone,
    '--agents',
    input.agents.join(','),
    '--json',
    ...input.persistArguments,
  ]);
  return seedOutputSchema.parse(JSON.parse(seeded.stdout)).connections;
}

async function seedWakeAccount(input: { phone: string; persistArguments: string[] }): Promise<WakeAccount> {
  const [connection] = await seedConnections({ phone: input.phone, agents: [WAKE_AGENT], persistArguments: input.persistArguments });
  if (!connection) throw new Error(`no connection seeded for ${input.phone}`);
  return { phone: input.phone, agent: connection.agent, secret: connection.secret };
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const persistDirectory = await mkdtemp(join(tmpdir(), 'zapbip-e2e-'));
  const port = await freePort();
  const origin = `http://${LOOPBACK_HOST}:${port}`;
  const persistArguments = ['--persist-to', persistDirectory];

  await runCommand('pnpm', [
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    DATABASE_BINDING,
    '--env',
    'development',
    '--local',
    ...persistArguments,
  ]);
  const connections = await seedConnections({ phone: SEED_PHONE, agents: SEED_AGENTS, persistArguments });
  const wakeAccounts = await WAKE_ACCOUNT_PHONES.reduce<Promise<WakeAccount[]>>(
    async (seededBefore, phone) => [...(await seededBefore), await seedWakeAccount({ phone, persistArguments })],
    Promise.resolve([]),
  );

  const server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--env',
      'development',
      '--ip',
      LOOPBACK_HOST,
      '--port',
      String(port),
      ...persistArguments,
      '--var',
      `MEDIA_LINK_SIGNING_KEY:${randomBytes(SIGNING_KEY_BYTES).toString('hex')}`,
      '--var',
      `UPLOAD_LINK_SIGNING_KEY:${randomBytes(SIGNING_KEY_BYTES).toString('hex')}`,
      '--var',
      `PUBLIC_ORIGIN:${origin}`,
      '--var',
      `WAKE_SECRET_KEY:${randomBytes(WAKE_SECRET_KEY_BYTES).toString('base64')}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  const logFile = join(persistDirectory, LOG_FILE_NAME);
  const logStream = createWriteStream(logFile);
  server.stdout.pipe(logStream);
  server.stderr.pipe(logStream);
  await waitForHealth({ origin, server, deadline: Date.now() + HEALTH_TIMEOUT_MS });

  project.provide('stack', {
    origin,
    phone: SEED_PHONE,
    secrets: Object.fromEntries(connections.map((connection) => [connection.agent, connection.secret])),
    wakeAccounts,
    logFile,
  });

  return async () => {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
    logStream.end();
    await rm(persistDirectory, { recursive: true, force: true });
  };
}
