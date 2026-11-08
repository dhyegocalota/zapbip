import { PluginRegistry, type AgentPlugin } from '../../src/contract';

const PACKAGE_FOLDER = 'libs/agents/testing/fixture-plugin-package';
const PLUGIN_VERSION = '0.0.1';
const REQUIREMENTS_SHA256 = 'f8b152ba844aebd2474b64425ae83702e9b8ed88b0132a7f6f29974bfa6db5eb';

export const plugin: AgentPlugin = {
  packageFolder: PACKAGE_FOLDER,
  packageName: '@zapbip/fixture-plugin-package',
  registry: PluginRegistry.SelfHostedWheel,
  version: PLUGIN_VERSION,
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
  versionPins: [{ path: `${PACKAGE_FOLDER}/package.json`, pattern: /"version": "0\.0\.1"/ }],
  endToEndModule: `${PACKAGE_FOLDER}/e2e/client.ts`,
};
