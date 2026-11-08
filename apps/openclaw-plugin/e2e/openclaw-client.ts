import { execFile } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CONTAINER_HOST } from '../../../scripts/e2e/clients/constants';
import { buildImage, type Container, startContainer } from '../../../scripts/e2e/clients/container';
import type { PluginClientInput } from '../../../scripts/e2e/clients/plugin-client';

const runCommand = promisify(execFile);
const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..', '..');
const PLUGIN_DIRECTORY = join(import.meta.dirname, '..');
const DOCKERFILE = join(import.meta.dirname, 'openclaw', 'Dockerfile');
const PLUGIN_PACKAGE_FILTER = '@zapbip/openclaw-plugin';
const OPENCLAW_IMAGE_TAG = 'zapbip-e2e-openclaw';
const PLUGIN_ARCHIVE_FILE = 'plugin.tgz';
const CONFIG_FILE = 'openclaw.json';
const CONFIG_MOUNT_PATH = '/root/.openclaw/openclaw.json';
const CERTIFICATE_MOUNT_PATH = '/etc/zapbip-front.pem';
const MODEL_ID = 'fake-model';
const MODEL_PROVIDER = 'fake';
const MODEL_CONTEXT_WINDOW = 32_000;
const MODEL_MAX_TOKENS = 2_048;
const FAKE_API_KEY = 'fake-key';

export async function buildPluginImage(input: { directory: string }): Promise<void> {
  await runCommand('pnpm', ['--filter', PLUGIN_PACKAGE_FILTER, 'build'], { cwd: REPOSITORY_ROOT });
  const packed = await runCommand('npm', ['pack', '--pack-destination', input.directory], { cwd: PLUGIN_DIRECTORY });
  const archiveName = packed.stdout.trim().split('\n').at(-1);
  if (!archiveName) throw new Error('npm pack printed no archive name');
  const contextDirectory = join(input.directory, 'openclaw-context');
  await mkdir(contextDirectory, { recursive: true });
  await copyFile(join(input.directory, archiveName), join(contextDirectory, PLUGIN_ARCHIVE_FILE));
  await buildImage({ tag: OPENCLAW_IMAGE_TAG, contextDirectory, dockerfile: DOCKERFILE, platform: null, buildArguments: {} });
}

function mcpConfigOf(input: { connectionLink: string; hasMcpServer: boolean }) {
  if (!input.hasMcpServer) return {};
  return { mcp: { servers: { zapbip: { url: input.connectionLink, transport: 'streamable-http' } } } };
}

function configOf(input: { connectionLink: string; fakeModelPort: number; hasMcpServer: boolean }) {
  return {
    ...mcpConfigOf(input),
    gateway: { mode: 'local', bind: 'loopback', auth: { mode: 'none' } },
    models: {
      providers: {
        [MODEL_PROVIDER]: {
          baseUrl: `http://${CONTAINER_HOST}:${input.fakeModelPort}/v1`,
          apiKey: FAKE_API_KEY,
          api: 'openai-completions',
          models: [
            {
              id: MODEL_ID,
              name: 'Fake',
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: MODEL_CONTEXT_WINDOW,
              maxTokens: MODEL_MAX_TOKENS,
            },
          ],
        },
      },
    },
    agents: { defaults: { model: { primary: `${MODEL_PROVIDER}/${MODEL_ID}` } } },
    channels: { zapbip: { connectionLink: input.connectionLink } },
    plugins: { entries: { zapbip: { enabled: true } } },
  };
}

export async function startPluginClient(input: PluginClientInput): Promise<Container> {
  const configFile = join(input.directory, `${input.name}-${CONFIG_FILE}`);
  await writeFile(configFile, JSON.stringify(configOf(input)));
  return startContainer({
    name: input.name,
    image: OPENCLAW_IMAGE_TAG,
    platform: null,
    environment: { NODE_EXTRA_CA_CERTS: CERTIFICATE_MOUNT_PATH },
    mounts: [`${configFile}:${CONFIG_MOUNT_PATH}`, `${input.certificateFile}:${CERTIFICATE_MOUNT_PATH}:ro`],
    command: ['openclaw', 'gateway', 'run'],
    entrypoint: null,
    logFiles: [],
  });
}
