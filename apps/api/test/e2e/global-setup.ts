import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { WAKE_SECRET_KEY_BYTES } from '@zapbip/core';
import { OwnerLocale } from '@zapbip/types';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';
import { DEVELOPMENT_ENVIRONMENT } from '../../src/contract/constants';
import { freePort, HEALTH_TIMEOUT_MS, LOOPBACK_HOST, waitForHealth } from './support/stack-process';

const runCommand = promisify(execFile);
const SEED_PHONE = '5511999990000';
const SEED_AGENTS = ['alpha', 'beta'];
const SECOND_SEED_PHONE = '5511999990010';
const SECOND_SEED_AGENTS = ['rotator', 'revoked', 'doomed'];
const WAKE_AGENT = 'grok';
const WAKE_ACCOUNT_PHONES = ['5511999990001', '5511999990002', '5511999990003', '5511999990004', '5511999990005'];
const SCHEDULED_AGENT = 'chatgpt';
const SCHEDULED_ACCOUNT_PHONES = ['5511999990021', '5511999990022', '5511999990023', '5511999990024'];
const ENGLISH_ACCOUNT_INDEX = 3;
const STANDBY_PHONE = '5511999990031';
const STANDBY_AGENTS = ['grok-web', 'grok-bot'];
const SIGNING_KEY_BYTES = 32;
const DATABASE_BINDING = 'CONNECTIONS';
const LOG_FILE_NAME = 'wrangler-dev.log';

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });

export type WakeAccount = { phone: string; agent: string; secret: string };

export type StackContext = {
  origin: string;
  phone: string;
  secrets: Record<string, string>;
  secondPhone: string;
  secondSecrets: Record<string, string>;
  wakeAccounts: WakeAccount[];
  scheduledAccounts: WakeAccount[];
  standbyPhone: string;
  standbySecrets: Record<string, string>;
  logFile: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    stack: StackContext;
  }
}

async function seedConnections(input: { phone: string; agents: string[]; origin: string }) {
  const seeded = await runCommand('pnpm', [
    'exec',
    'tsx',
    'scripts/dev-seed.ts',
    '--phone',
    input.phone,
    '--agents',
    input.agents.join(','),
    '--json',
    '--origin',
    input.origin,
  ]);
  return seedOutputSchema.parse(JSON.parse(seeded.stdout)).connections;
}

async function seedWakeAccount(input: { phone: string; agent: string; origin: string }): Promise<WakeAccount> {
  const [connection] = await seedConnections({ phone: input.phone, agents: [input.agent], origin: input.origin });
  if (!connection) throw new Error(`no connection seeded for ${input.phone}`);
  return { phone: input.phone, agent: connection.agent, secret: connection.secret };
}

async function setOwnerLocale(input: { phone: string; locale: OwnerLocale; persistArguments: string[] }): Promise<void> {
  await runCommand('pnpm', [
    'exec',
    'wrangler',
    'd1',
    'execute',
    DATABASE_BINDING,
    '--env',
    DEVELOPMENT_ENVIRONMENT,
    '--local',
    ...input.persistArguments,
    '--command',
    `UPDATE owner_identities SET locale = '${input.locale}' WHERE wa_id = '${input.phone}'`,
  ]);
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
    DEVELOPMENT_ENVIRONMENT,
    '--local',
    ...persistArguments,
  ]);
  const server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--env',
      DEVELOPMENT_ENVIRONMENT,
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
  const connections = await seedConnections({ phone: SEED_PHONE, agents: SEED_AGENTS, origin });
  const secondConnections = await seedConnections({ phone: SECOND_SEED_PHONE, agents: SECOND_SEED_AGENTS, origin });
  const wakeAccounts = await WAKE_ACCOUNT_PHONES.reduce<Promise<WakeAccount[]>>(
    async (seededBefore, phone) => [...(await seededBefore), await seedWakeAccount({ phone, agent: WAKE_AGENT, origin })],
    Promise.resolve([]),
  );
  const scheduledAccounts = await SCHEDULED_ACCOUNT_PHONES.reduce<Promise<WakeAccount[]>>(
    async (seededBefore, phone) => [...(await seededBefore), await seedWakeAccount({ phone, agent: SCHEDULED_AGENT, origin })],
    Promise.resolve([]),
  );
  const englishAccount = scheduledAccounts[ENGLISH_ACCOUNT_INDEX];
  if (!englishAccount) throw new Error('no english scheduled account');
  await setOwnerLocale({ phone: englishAccount.phone, locale: OwnerLocale.EnglishUs, persistArguments });
  const standbyConnections = await seedConnections({ phone: STANDBY_PHONE, agents: STANDBY_AGENTS, origin });

  project.provide('stack', {
    origin,
    phone: SEED_PHONE,
    secrets: Object.fromEntries(connections.map((connection) => [connection.agent, connection.secret])),
    secondPhone: SECOND_SEED_PHONE,
    secondSecrets: Object.fromEntries(secondConnections.map((connection) => [connection.agent, connection.secret])),
    wakeAccounts,
    scheduledAccounts,
    standbyPhone: STANDBY_PHONE,
    standbySecrets: Object.fromEntries(standbyConnections.map((connection) => [connection.agent, connection.secret])),
    logFile,
  });

  return async () => {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
    logStream.end();
    await rm(persistDirectory, { recursive: true, force: true });
  };
}
