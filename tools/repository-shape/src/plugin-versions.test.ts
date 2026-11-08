import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const SHARED_CONSTANTS = 'libs/types/src/constants.ts';
const REQUIRE_HASHES_INSTALL = '--require-hashes -r';
const WORKFLOW_FILE = '.github/workflows/verify.yml';
const PIP_INSTALL_PATTERN = /^\s*- run: python3 -m pip install (.+)$/gm;

const sharedVersion = /export const ZAPBIP_NPM_VERSION = '([^']+)'/.exec(readRepositoryFile(SHARED_CONSTANTS))?.[1];
describe('the plugin versions', () => {
  test.each(Object.entries(AGENT_PLUGINS))('the %s plugin declares the shared version and every file it pins', (_id, plugin) => {
    expect(plugin.version).toBe(sharedVersion);
    plugin.versionPins.forEach((pin) => expect(readRepositoryFile(pin.path)).toMatch(pin.pattern));
  });

  test('the workflow installs the Python requirements only with --require-hashes from the hashed development lock', () => {
    const installs = [...readRepositoryFile(WORKFLOW_FILE).matchAll(PIP_INSTALL_PATTERN)].map((match) => match[1]);
    const pythonRequirements = Object.values(AGENT_PLUGINS).flatMap((plugin) =>
      plugin.workflow.pythonRequirements === null ? [] : [plugin.workflow.pythonRequirements],
    );
    const allowedInstalls = pythonRequirements.map((path) => `${REQUIRE_HASHES_INSTALL} ${path}`);
    expect(installs.every((install) => install !== undefined && allowedInstalls.includes(install))).toBe(true);
    expect(installs.length > 0).toBe(pythonRequirements.length > 0);
  });
});
