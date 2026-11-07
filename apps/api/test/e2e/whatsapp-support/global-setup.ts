import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';
import { freePort, HEALTH_TIMEOUT_MS, LOOPBACK_HOST, waitForHealth } from '../support/stack-process';
import { startFakeGraph } from '../../support/fake-graph';
import type { StackContext } from '../global-setup';
import { ACCESS_TOKEN, APP_SECRET, FAKE_GRAPH_PORT, OWNER_PHONE, PHONE_NUMBER_ID, SEED_AGENTS, VERIFY_TOKEN } from './constants';

const runCommand = promisify(execFile);
const SIGNING_KEY_BYTES = 32;
const DATABASE_BINDING = 'CONNECTIONS';
const DEVELOPMENT_ENVIRONMENT_ARGUMENTS = ['--env', 'development'];
const LOG_FILE_NAME = 'wrangler-dev.log';

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const fakeGraph = await startFakeGraph({ port: FAKE_GRAPH_PORT });
  const persistDirectory = await mkdtemp(join(tmpdir(), 'zapbip-e2e-whatsapp-'));
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
    ...DEVELOPMENT_ENVIRONMENT_ARGUMENTS,
    '--local',
    ...persistArguments,
  ]);
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
    WHATSAPP_MEDIA_DOWNLOAD_ORIGIN: `http://${LOOPBACK_HOST}:${FAKE_GRAPH_PORT}`,
  };
  const server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      ...DEVELOPMENT_ENVIRONMENT_ARGUMENTS,
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
    wakeAccounts: [],
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
