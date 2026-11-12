import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { WAKE_SECRET_KEY_BYTES } from '@zapbip/core';
import { startFakeGraph } from '../../test/support/fake-graph';
import {
  BACKOFFICE_TEST_KEY_DIGEST,
  BACKOFFICE_TEST_PASSWORD_PEPPER,
  BACKOFFICE_TEST_TOTP_SECRET,
} from '../../test/support/backoffice-credentials';
import { freePort, HEALTH_TIMEOUT_MS, LOOPBACK_HOST } from '../../test/e2e/support/stack-process';
import { waitForSignIn } from './support/wait-for-sign-in';
import { WalkVariable } from './support/walk-environment';

const runCommand = promisify(execFile);
const SIGNING_KEY_BYTES = 32;
const DATABASE_BINDING = 'CONNECTIONS';
const DEVELOPMENT_ENVIRONMENT_ARGUMENTS = ['--env', 'development'];
const BACKOFFICE_HOST = 'backoffice.localhost';
const VERIFY_TOKEN = 'backoffice-walk-verify-token';
const META_APP_SECRET = 'backoffice-walk-meta-app-secret';

export default async function setup(): Promise<() => Promise<void>> {
  const persistDirectory = await mkdtemp(join(tmpdir(), 'zapbip-backoffice-walk-'));
  const persistArguments = ['--persist-to', persistDirectory];
  const fakeGraph = await startFakeGraph({ port: await freePort() });
  const graphBaseUrl = `http://${LOOPBACK_HOST}:${fakeGraph.port}`;
  const port = await freePort();
  const origin = `http://${BACKOFFICE_HOST}:${port}`;
  const variables = {
    MEDIA_LINK_SIGNING_KEY: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
    UPLOAD_LINK_SIGNING_KEY: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
    WAKE_SECRET_KEY: randomBytes(WAKE_SECRET_KEY_BYTES).toString('base64'),
    NUMBER_REGISTRY_KEY: randomBytes(WAKE_SECRET_KEY_BYTES).toString('base64'),
    BACKOFFICE_KEY_DIGEST: BACKOFFICE_TEST_KEY_DIGEST,
    BACKOFFICE_TOTP_SECRET: BACKOFFICE_TEST_TOTP_SECRET,
    BACKOFFICE_PASSWORD_PEPPER: BACKOFFICE_TEST_PASSWORD_PEPPER,
    BACKOFFICE_ORIGIN: origin,
    PUBLIC_ORIGIN: `http://${LOOPBACK_HOST}:${port}`,
    WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
    META_APP_SECRET: META_APP_SECRET,
    WHATSAPP_GRAPH_BASE_URL: graphBaseUrl,
    WHATSAPP_MEDIA_DOWNLOAD_ORIGIN: graphBaseUrl,
  };
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
    { stdio: 'ignore', detached: true },
  );
  await waitForSignIn({ origin, server, deadline: Date.now() + HEALTH_TIMEOUT_MS });
  process.env[WalkVariable.Origin] = origin;
  process.env[WalkVariable.PersistDirectory] = persistDirectory;
  process.env[WalkVariable.GraphBaseUrl] = graphBaseUrl;

  return async () => {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
    await fakeGraph.stop();
    await rm(persistDirectory, { recursive: true, force: true });
  };
}
