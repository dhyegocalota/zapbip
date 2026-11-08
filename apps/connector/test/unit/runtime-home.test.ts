import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONNECTOR_RUNTIMES, ConnectorClient } from '@zapbip/agents/connector';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeDirectoryOf } from '../../src/runtime-home';
import { CONNECTOR_CLIENTS } from '../support/connector-clients';

const OVERRIDDEN_DIRECTORY = '/somewhere/else';

describe.each(CONNECTOR_CLIENTS)('homeDirectoryOf the %s runtime', (client) => {
  const { homeFolder, homeVariable } = CONNECTOR_RUNTIMES[client];

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is the folder of its runtime under the home of the owner when the variable is not set', () => {
    vi.stubEnv(homeVariable, '');
    expect(homeDirectoryOf({ client })).toBe(join(homedir(), homeFolder));
  });

  it('is the directory its variable names when it is set', () => {
    vi.stubEnv(homeVariable, OVERRIDDEN_DIRECTORY);
    expect(homeDirectoryOf({ client })).toBe(OVERRIDDEN_DIRECTORY);
  });
});
