import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONTAINER_HOST } from './constants';
import { type Container, startContainer } from './container';

const PLUGIN_DIRECTORY = join(import.meta.dirname, '..', '..', '..', 'apps', 'hermes-plugin', 'zapbip_platform');
const HERMES_IMAGE = 'nousresearch/hermes-agent:v0.22.7';
const HERMES_PLATFORM = 'linux/amd64';
const PLUGIN_NAME = 'zapbip-platform';
const PACKAGE_NAME = 'zapbip_platform';
const DATA_PATH = '/opt/data';
const PACKAGE_ROOT_PATH = '/opt/zapbip';
const SITE_PACKAGES_PATH = '/opt/hermes/.venv/lib/python3.14/site-packages';
const PATH_FILE_NAME = 'zapbip.pth';
const CERTIFICATE_MOUNT_PATH = '/etc/zapbip-front.pem';
const CONNECTION_LINK_VARIABLE = 'ZAPBIP_CONNECTION_LINK';
const ALLOWED_USERS_VARIABLE = 'ZAPBIP_ALLOWED_USERS';
const CONFIG_VERSION = 52;
const FAKE_API_KEY = 'fake-key';
const MODEL_ID = 'fake-model';
const LOG_FILES = [`${DATA_PATH}/logs/gateway.log`, `${DATA_PATH}/logs/agent.log`];

export type HermesClientInput = {
  name: string;
  directory: string;
  connectionLink: string;
  allowedUsers: string;
  packageImportable: boolean;
  fakeModelPort: number;
  certificateFile: string;
};

function configOf(input: { fakeModelPort: number }): string {
  return [
    'model:',
    '  provider: custom',
    `  default: ${MODEL_ID}`,
    `  base_url: http://${CONTAINER_HOST}:${input.fakeModelPort}/v1`,
    `  api_key: ${FAKE_API_KEY}`,
    'plugins:',
    '  enabled:',
    `    - ${PLUGIN_NAME}`,
    `_config_version: ${CONFIG_VERSION}`,
    '',
  ].join('\n');
}

function packageMounts(input: { packageImportable: boolean; pluginDirectory: string; pathFile: string }): string[] {
  if (!input.packageImportable) return [];
  return [
    `${input.pluginDirectory}:${PACKAGE_ROOT_PATH}/${PACKAGE_NAME}:ro`,
    `${input.pathFile}:${SITE_PACKAGES_PATH}/${PATH_FILE_NAME}:ro`,
  ];
}

export async function startHermesClient(input: HermesClientInput): Promise<Container> {
  const homeDirectory = join(input.directory, `${input.name}-home`);
  const pluginDirectory = join(homeDirectory, PLUGIN_NAME);
  const configFile = join(homeDirectory, 'config.yaml');
  const pathFile = join(homeDirectory, PATH_FILE_NAME);
  await mkdir(homeDirectory, { recursive: true });
  await cp(PLUGIN_DIRECTORY, pluginDirectory, { recursive: true, filter: (source) => !source.includes('__pycache__') });
  await writeFile(configFile, configOf(input));
  await writeFile(pathFile, `${PACKAGE_ROOT_PATH}\n`);
  return startContainer({
    name: input.name,
    image: HERMES_IMAGE,
    platform: HERMES_PLATFORM,
    environment: {
      [CONNECTION_LINK_VARIABLE]: input.connectionLink,
      [ALLOWED_USERS_VARIABLE]: input.allowedUsers,
      SSL_CERT_FILE: CERTIFICATE_MOUNT_PATH,
    },
    mounts: [
      DATA_PATH,
      `${configFile}:${DATA_PATH}/config.yaml`,
      `${pluginDirectory}:${DATA_PATH}/plugins/${PLUGIN_NAME}`,
      `${input.certificateFile}:${CERTIFICATE_MOUNT_PATH}:ro`,
      ...packageMounts({ packageImportable: input.packageImportable, pluginDirectory, pathFile }),
    ],
    command: ['gateway', 'run'],
    entrypoint: null,
    logFiles: LOG_FILES,
  });
}
