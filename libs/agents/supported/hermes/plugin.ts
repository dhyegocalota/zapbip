import {
  hermesRequirementsPath,
  PRODUCTION_PUBLIC_ORIGIN,
  ZAPBIP_HERMES_PLUGIN_VERSION,
  ZAPBIP_HERMES_REQUIREMENTS_SHA256,
} from '@zapbip/types';
import { type AgentPlugin, type HostedArtifact, PluginRegistry } from '../../src/contract';
import { versionPinOf } from '../../src/version-pin';

const PACKAGE_FOLDER = 'apps/hermes-plugin';
const REQUIREMENTS_URL = `${PRODUCTION_PUBLIC_ORIGIN}${hermesRequirementsPath({ version: ZAPBIP_HERMES_PLUGIN_VERSION })}`;
const DOWNLOADED_FILE = '"$d/zapbip-requirements.txt"';
const HASH_CHECK = `python3 -c 'import hashlib,sys; sys.exit(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest() != sys.argv[2])'`;

export const installCommand = `d=$(mktemp -d) && curl -fsSL ${REQUIREMENTS_URL} -o ${DOWNLOADED_FILE} && ${HASH_CHECK} ${DOWNLOADED_FILE} ${ZAPBIP_HERMES_REQUIREMENTS_SHA256} && python3 -m pip install --only-binary=:all: --require-hashes -r ${DOWNLOADED_FILE}`;

export const plugin: AgentPlugin = {
  packageFolder: PACKAGE_FOLDER,
  packageName: 'zapbip-platform',
  registry: PluginRegistry.SelfHostedWheel,
  version: ZAPBIP_HERMES_PLUGIN_VERSION,
  installCommand,
  get hostedArtifacts(): HostedArtifact[] {
    throw new Error('hermes hosted artifacts are not implemented');
  },
  workflow: { name: 'hermes-plugin', filter: '@zapbip/hermes-plugin', pythonRequirements: `${PACKAGE_FOLDER}/requirements-dev.txt` },
  buildRequirements: `${PACKAGE_FOLDER}/e2e/hermes/build-requirements.txt`,
  versionPins: [
    versionPinOf({ path: `${PACKAGE_FOLDER}/pyproject.toml`, before: 'version = "', version: ZAPBIP_HERMES_PLUGIN_VERSION, after: '"' }),
    versionPinOf({
      path: `${PACKAGE_FOLDER}/zapbip_platform/constants.py`,
      before: 'PLUGIN_VERSION = "',
      version: ZAPBIP_HERMES_PLUGIN_VERSION,
      after: '"',
    }),
    versionPinOf({
      path: `${PACKAGE_FOLDER}/zapbip_platform/plugin.yaml`,
      before: 'version: ',
      version: ZAPBIP_HERMES_PLUGIN_VERSION,
      after: '',
    }),
  ],
  endToEndModule: `${PACKAGE_FOLDER}/e2e/hermes-client.ts`,
};
