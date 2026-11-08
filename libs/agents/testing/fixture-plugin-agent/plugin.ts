import { ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { PluginRegistry, type AgentPlugin } from '../../src/contract';
import { versionPinOf } from '../../src/version-pin';

const PACKAGE_FOLDER = 'libs/agents/testing/fixture-plugin-package';
const REQUIREMENTS_SHA256 = 'eb1fc5e4bae42f5a04d9bc2001ef4516367ff8520495100b1ccaec1320b85f84';

export const plugin: AgentPlugin = {
  packageFolder: PACKAGE_FOLDER,
  packageName: '@zapbip/fixture-plugin-package',
  registry: PluginRegistry.SelfHostedWheel,
  version: ZAPBIP_NPM_VERSION,
  installCommand: `pip install --require-hashes --requirement https://mcp.zapbip.com/pkg/fixture-requirements.txt # sha256:${REQUIREMENTS_SHA256}`,
  hostedArtifacts: [
    {
      label: 'fixture requirements file',
      filename: 'fixture-requirements.txt',
      path: '/pkg/fixture-requirements.txt',
      contentType: 'text/plain',
      expectedSha256: REQUIREMENTS_SHA256,
      releaseFolder: `${PACKAGE_FOLDER}/release`,
      embeddedInInstallCommand: true,
    },
  ],
  workflow: { name: 'fixture-plugin', filter: 'fixture-plugin-package', pythonRequirements: null },
  buildRequirements: null,
  versionPins: [versionPinOf({ path: `${PACKAGE_FOLDER}/package.json`, before: '"version": "', version: ZAPBIP_NPM_VERSION, after: '"' })],
  endToEndModule: `${PACKAGE_FOLDER}/e2e/client.ts`,
};
