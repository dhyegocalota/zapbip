import { ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { type AgentPlugin, PluginRegistry } from '../../src/contract';
import { versionPinOf } from '../../src/version-pin';

const PACKAGE_FOLDER = 'apps/openclaw-plugin';
const PACKAGE_NAME = '@zapbip/openclaw-plugin';
const PLUGIN_VERSION = '0.1.0';

export const installCommand = `openclaw plugins install ${PACKAGE_NAME}@${ZAPBIP_NPM_VERSION} --force --accept-capabilities`;

export const plugin: AgentPlugin = {
  packageFolder: PACKAGE_FOLDER,
  packageName: PACKAGE_NAME,
  registry: PluginRegistry.Npm,
  version: PLUGIN_VERSION,
  installCommand,
  hostedArtifacts: [],
  workflow: { name: 'openclaw-plugin', filter: PACKAGE_NAME, pythonRequirements: null },
  buildRequirements: null,
  versionPins: [versionPinOf({ path: `${PACKAGE_FOLDER}/package.json`, before: '"version": "', version: PLUGIN_VERSION, after: '"' })],
  endToEndModule: `${PACKAGE_FOLDER}/e2e/openclaw-client.ts`,
};
