import { createHash } from 'node:crypto';
import { PluginRegistry, type AgentPlugin, type HostedArtifact } from '@zapbip/agents/plugins';
import { PACKAGE_PATH_PREFIX } from '@zapbip/types';

const SAMPLE_VERSION = '1.2.3';
const SAMPLE_PACKAGE_FOLDER = 'apps/sample-plugin';
const SAMPLE_BASENAME = 'sample_platform';
const WHEEL_CONTENT_TYPE = 'application/octet-stream';
const REQUIREMENTS_CONTENT_TYPE = 'text/plain; charset=utf-8';

export const SAMPLE_WHEEL_FILENAME = `${SAMPLE_BASENAME}-${SAMPLE_VERSION}-py3-none-any.whl`;
export const SAMPLE_REQUIREMENTS_FILENAME = `${SAMPLE_BASENAME}-${SAMPLE_VERSION}-requirements.txt`;
export const SAMPLE_WHEEL_SHA256 = createHash('sha256').update('hosted-wheel').digest('hex');
export const SAMPLE_REQUIREMENTS_SHA256 = createHash('sha256').update('hosted-requirements').digest('hex');
export const SAMPLE_OTHER_SHA256 = createHash('sha256').update('another-wheel').digest('hex');

const wheelArtifact: HostedArtifact = {
  label: 'sample wheel',
  filename: SAMPLE_WHEEL_FILENAME,
  path: `${PACKAGE_PATH_PREFIX}${SAMPLE_WHEEL_FILENAME}`,
  contentType: WHEEL_CONTENT_TYPE,
  expectedSha256: SAMPLE_WHEEL_SHA256,
  releaseFolder: `${SAMPLE_PACKAGE_FOLDER}/release`,
  embeddedInInstallCommand: false,
};
const requirementsArtifact: HostedArtifact = {
  label: 'sample requirements file',
  filename: SAMPLE_REQUIREMENTS_FILENAME,
  path: `${PACKAGE_PATH_PREFIX}${SAMPLE_REQUIREMENTS_FILENAME}`,
  contentType: REQUIREMENTS_CONTENT_TYPE,
  expectedSha256: SAMPLE_REQUIREMENTS_SHA256,
  releaseFolder: `${SAMPLE_PACKAGE_FOLDER}/release`,
  embeddedInInstallCommand: true,
};

export const SAMPLE_PLUGIN: AgentPlugin = {
  packageFolder: SAMPLE_PACKAGE_FOLDER,
  packageName: 'sample-platform',
  registry: PluginRegistry.SelfHostedWheel,
  version: SAMPLE_VERSION,
  installCommand: `pip install --require-hashes -r ${SAMPLE_REQUIREMENTS_FILENAME} # sha256:${SAMPLE_REQUIREMENTS_SHA256}`,
  hostedArtifacts: [wheelArtifact, requirementsArtifact],
  workflow: { name: 'sample-plugin', filter: '@zapbip/sample-plugin', pythonRequirements: null },
  buildRequirements: null,
  versionPins: [],
  endToEndModule: `${SAMPLE_PACKAGE_FOLDER}/e2e/client.ts`,
};

export const SAMPLE_NPM_PACKAGE_NAME = '@zapbip/sample-npm-plugin';
export const SAMPLE_NPM_VERSION = '0.1.0';

export const SAMPLE_NPM_PLUGIN: AgentPlugin = {
  packageFolder: 'apps/sample-npm-plugin',
  packageName: SAMPLE_NPM_PACKAGE_NAME,
  registry: PluginRegistry.Npm,
  version: SAMPLE_NPM_VERSION,
  installCommand: `sample plugins install ${SAMPLE_NPM_PACKAGE_NAME}@${SAMPLE_NPM_VERSION}`,
  hostedArtifacts: [],
  workflow: { name: 'sample-npm-plugin', filter: SAMPLE_NPM_PACKAGE_NAME, pythonRequirements: null },
  buildRequirements: null,
  versionPins: [],
  endToEndModule: 'apps/sample-npm-plugin/e2e/client.ts',
};
