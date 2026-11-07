import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ZAPBIP_HERMES_PLUGIN_VERSION, ZAPBIP_HERMES_WHEEL_SHA256 } from '../../../libs/types/src/constants';
import { hermesWheelFilename } from '../../../libs/types/src/hermes-wheel';
import { CONTAINER_HOST } from './constants';
import { buildImage, type Container, startContainer } from './container';

const WHEEL_RELEASE_DIRECTORY = join(import.meta.dirname, '..', '..', '..', 'apps', 'hermes-plugin', 'release');
const DOCKERFILE = join(import.meta.dirname, 'hermes', 'Dockerfile');
const HERMES_IMAGE = 'nousresearch/hermes-agent:v0.22.7@sha256:e6d81ae52ebf6a43efa529701405509f20054ba818f179ddd748bed4f8af584c';
const HERMES_IMAGE_TAG = 'zapbip-e2e-hermes';
const HERMES_IMAGE_ARGUMENT = 'HERMES_IMAGE';
const WHEEL_FILENAME_ARGUMENT = 'WHEEL_FILENAME';
const WHEEL_SHA256_ARGUMENT = 'WHEEL_SHA256';
const HERMES_PLATFORM = 'linux/amd64';
const PLUGIN_NAME = 'zapbip-platform';
const DATA_PATH = '/opt/data';
const CERTIFICATE_MOUNT_PATH = '/etc/zapbip-front.pem';
const CONNECTION_LINK_VARIABLE = 'ZAPBIP_CONNECTION_LINK';
const ALLOWED_USERS_VARIABLE = 'ZAPBIP_ALLOWED_USERS';
const CONFIG_VERSION = 52;
const FAKE_API_KEY = 'fake-key';
const MODEL_ID = 'fake-model';
const LOG_FILES = [`${DATA_PATH}/logs/gateway.log`, `${DATA_PATH}/logs/agent.log`];

export async function buildHermesImage(input: { directory: string }): Promise<void> {
  const contextDirectory = join(input.directory, 'hermes-context');
  const wheelDirectory = join(contextDirectory, 'wheel');
  await mkdir(wheelDirectory, { recursive: true });
  const wheelFilename = hermesWheelFilename({ version: ZAPBIP_HERMES_PLUGIN_VERSION });
  await copyFile(join(WHEEL_RELEASE_DIRECTORY, wheelFilename), join(wheelDirectory, wheelFilename));
  await buildImage({
    tag: HERMES_IMAGE_TAG,
    contextDirectory,
    dockerfile: DOCKERFILE,
    platform: HERMES_PLATFORM,
    buildArguments: {
      [HERMES_IMAGE_ARGUMENT]: HERMES_IMAGE,
      [WHEEL_FILENAME_ARGUMENT]: wheelFilename,
      [WHEEL_SHA256_ARGUMENT]: ZAPBIP_HERMES_WHEEL_SHA256,
    },
  });
}

export type HermesClientInput = {
  name: string;
  directory: string;
  connectionLink: string;
  allowedUsers: string;
  hasMcpServer: boolean;
  fakeModelPort: number;
  certificateFile: string;
};

function mcpServersLines(input: { connectionLink: string; hasMcpServer: boolean }): string[] {
  if (!input.hasMcpServer) return [];
  return ['mcp_servers:', '  zapbip:', `    url: ${input.connectionLink}`];
}

function configOf(input: { fakeModelPort: number; connectionLink: string; hasMcpServer: boolean }): string {
  return [
    'model:',
    '  provider: custom',
    `  default: ${MODEL_ID}`,
    `  base_url: http://${CONTAINER_HOST}:${input.fakeModelPort}/v1`,
    `  api_key: ${FAKE_API_KEY}`,
    'logging:',
    '  level: DEBUG',
    'plugins:',
    '  enabled:',
    `    - ${PLUGIN_NAME}`,
    ...mcpServersLines(input),
    `_config_version: ${CONFIG_VERSION}`,
    '',
  ].join('\n');
}

export async function startHermesClient(input: HermesClientInput): Promise<Container> {
  const homeDirectory = join(input.directory, `${input.name}-home`);
  const configFile = join(homeDirectory, 'config.yaml');
  await mkdir(homeDirectory, { recursive: true });
  await writeFile(configFile, configOf(input));
  return startContainer({
    name: input.name,
    image: HERMES_IMAGE_TAG,
    platform: HERMES_PLATFORM,
    environment: {
      [CONNECTION_LINK_VARIABLE]: input.connectionLink,
      [ALLOWED_USERS_VARIABLE]: input.allowedUsers,
      SSL_CERT_FILE: CERTIFICATE_MOUNT_PATH,
    },
    mounts: [DATA_PATH, `${configFile}:${DATA_PATH}/config.yaml`, `${input.certificateFile}:${CERTIFICATE_MOUNT_PATH}:ro`],
    command: ['gateway', 'run'],
    entrypoint: null,
    logFiles: LOG_FILES,
  });
}
