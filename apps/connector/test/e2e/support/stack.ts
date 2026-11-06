import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { request } from 'node:https';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CONNECTOR_PATH_SUFFIX, MessageKind, SECOND_MS, HttpStatus } from '@zapbip/types';
import { z } from 'zod';

const runCommand = promisify(execFile);
const API_DIRECTORY = fileURLToPath(new URL('../../../../api', import.meta.url));
const HEALTH_PATH = '/health';
const HEALTH_TIMEOUT_MS = 60 * SECOND_MS;
const HEALTH_POLL_INTERVAL_MS = 250;
const HTTP_OK = 200;
const LOOPBACK_HOST = '127.0.0.1';
const DATABASE_BINDING = 'CONNECTIONS';
const SIGNING_KEY_BYTES = 32;
const WAKE_SECRET_KEY_BYTES = 32;
const OWNER_PHONE = '5511999990000';
const LOG_FILE_NAME = 'wrangler-dev.log';
const MCP_CONFIG_FILE_NAME = 'mcp.json';
const PRIVATE_FILE_MODE = 0o600;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });

export type ScreenEntry = { text: string };

export type StackAgent = { connectionUrl: string; mcpConfigFile: string };

export type Stack = {
  origin: string;
  agents: Record<string, StackAgent>;
  postOwnerText: (input: { text: string }) => Promise<void>;
  readScreen: () => Promise<ScreenEntry[]>;
  stop: () => Promise<void>;
};

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

type HttpsAnswer = { status: number; body: string };

function httpsRequest(input: { url: string; method: string; body: string | null }): Promise<HttpsAnswer> {
  return new Promise((resolve, reject) => {
    const outgoing = request(input.url, { method: input.method, headers: JSON_HEADERS, rejectUnauthorized: false }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => resolve({ status: incoming.statusCode as number, body: Buffer.concat(chunks).toString() }));
    });
    outgoing.on('error', reject);
    outgoing.end(input.body);
  });
}

async function waitForHealth(input: { origin: string; server: ChildProcess; deadline: number }): Promise<void> {
  const answer = await httpsRequest({ url: `${input.origin}${HEALTH_PATH}`, method: 'GET', body: null }).catch(() => null);
  if (answer !== null && answer.status === HTTP_OK) return;
  if (input.server.exitCode !== null) throw new Error(`wrangler dev exited with ${input.server.exitCode}`);
  if (Date.now() > input.deadline) throw new Error(`wrangler dev did not answer ${HEALTH_PATH} within ${HEALTH_TIMEOUT_MS} ms`);
  await delay(HEALTH_POLL_INTERVAL_MS);
  return waitForHealth(input);
}

async function waitForProbe(input: { origin: string; secret: string; deadline: number }): Promise<void> {
  const answer = await httpsRequest({ url: `${input.origin}/c/${input.secret}${CONNECTOR_PATH_SUFFIX}`, method: 'GET', body: null }).catch(
    () => null,
  );
  if (answer !== null && answer.status === HttpStatus.UpgradeRequired) return;
  if (Date.now() > input.deadline) throw new Error('the connector route did not answer 426 in time');
  await delay(HEALTH_POLL_INTERVAL_MS);
  return waitForProbe(input);
}

async function seedConnections(input: { agents: string[]; persistArguments: string[] }): Promise<Record<string, string>> {
  const seeded = await runCommand(
    'pnpm',
    ['exec', 'tsx', 'scripts/dev-seed.ts', '--phone', OWNER_PHONE, '--agents', input.agents.join(','), '--json', ...input.persistArguments],
    { cwd: API_DIRECTORY },
  );
  const { connections } = seedOutputSchema.parse(JSON.parse(seeded.stdout));
  return Object.fromEntries(connections.map((connection) => [connection.agent, connection.secret]));
}

export async function startStack(input: { agents: string[] }): Promise<Stack> {
  const persistDirectory = await mkdtemp(join(tmpdir(), 'zapbip-connector-e2e-'));
  const [port, inspectorPort] = await Promise.all([freePort(), freePort()]);
  const origin = `https://${LOOPBACK_HOST}:${port}`;
  const persistArguments = ['--persist-to', persistDirectory];

  await runCommand(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'migrations', 'apply', DATABASE_BINDING, '--env', 'development', '--local', ...persistArguments],
    {
      cwd: API_DIRECTORY,
    },
  );
  const secrets = await seedConnections({ agents: input.agents, persistArguments });
  const server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--env',
      'development',
      '--local-protocol',
      'https',
      '--ip',
      LOOPBACK_HOST,
      '--port',
      String(port),
      '--inspector-port',
      String(inspectorPort),
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
    { cwd: API_DIRECTORY, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  const logStream = createWriteStream(join(persistDirectory, LOG_FILE_NAME));
  server.stdout.pipe(logStream);
  server.stderr.pipe(logStream);
  await Promise.all(Object.values(secrets).map((secret) => waitForProbe({ origin, secret, deadline: Date.now() + HEALTH_TIMEOUT_MS })));
  const agentEntries = await Promise.all(
    input.agents.map(async (agent): Promise<[string, StackAgent]> => {
      const connectionUrl = `${origin}/c/${secrets[agent]}/mcp`;
      const mcpConfigFile = join(persistDirectory, `${agent}-${MCP_CONFIG_FILE_NAME}`);
      await writeFile(mcpConfigFile, JSON.stringify({ url: connectionUrl }), { mode: PRIVATE_FILE_MODE });
      return [agent, { connectionUrl, mcpConfigFile }];
    }),
  );

  function ownerRequest(path: string, init: { method: string; body: string | null }): Promise<HttpsAnswer> {
    return httpsRequest({ url: `${origin}/dev/owner/${OWNER_PHONE}${path}`, ...init });
  }

  return {
    origin,
    agents: Object.fromEntries(agentEntries),
    postOwnerText: async ({ text }) => {
      const answer = await ownerRequest('/messages', {
        method: 'POST',
        body: JSON.stringify({ kind: MessageKind.Text, text, reply_to: null }),
      });
      if (answer.status !== HTTP_OK) throw new Error(`owner simulator answered ${answer.status}`);
    },
    readScreen: async () => {
      const answer = await ownerRequest('/screen', { method: 'GET', body: null });
      return (JSON.parse(answer.body) as { entries: ScreenEntry[] }).entries;
    },
    stop: async () => {
      if (server.pid) process.kill(-server.pid, 'SIGTERM');
      logStream.end();
      await rm(persistDirectory, { recursive: true, force: true });
    },
  };
}
