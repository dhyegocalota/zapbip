import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONNECTION_URL_VARIABLE, CONNECTOR_CONFIG_FILE_NAME, ConnectorSessionSource, ConnectorWakeOutcome } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchOf, readConnectorConfig, resolveConnectorConfigPath } from '../../src/connector-config';
import { runWake } from '../../src/wake-runner';
import { createFakeClients, runAt, type FakeClients } from '../support/fake-client-binary';
import { ownerTextMessage } from '../support/fake-event-server';
import { SUBJECT_CLIENT } from '../support/connector-clients';

const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const OTHER_CONNECTION_LINK = 'https://elsewhere.example/c/other/mcp';
const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const CLIENT = SUBJECT_CLIENT;
const CUSTOM_COMMAND = 'ccs';
const CUSTOM_ARGUMENT = '--some-flag';
const PROBE_VALUE = 'from-config';

describe('a connector config that names another command for the subject client', () => {
  let fakeClients: FakeClients;

  beforeEach(async () => {
    fakeClients = await createFakeClients();
    fakeClients.apply({ behavior: {} });
    await fakeClients.writeCommand({ client: CLIENT, name: CUSTOM_COMMAND });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fakeClients.cleanup();
  });

  it('launches that command with its arguments before the runtime arguments, and with its environment', async () => {
    const configFile = join(fakeClients.workingDirectory, CONNECTOR_CONFIG_FILE_NAME);
    const agents = {
      [CLIENT]: {
        command: CUSTOM_COMMAND,
        args: [CUSTOM_ARGUMENT],
        environment: { FAKE_CLIENT_PROBE: PROBE_VALUE, [CONNECTION_URL_VARIABLE]: OTHER_CONNECTION_LINK },
      },
    };
    await writeFile(configFile, JSON.stringify({ agents }));
    const configPath = await resolveConnectorConfigPath({
      flagPath: null,
      environment: {},
      workingDirectory: fakeClients.workingDirectory,
    });
    const config = await readConnectorConfig({ configPath });

    const result = await runWake({
      client: CLIENT,
      launch: launchOf({ config, client: CLIENT }),
      connectionLink: CONNECTION_LINK,
      sessionSource: ConnectorSessionSource.Pinned,
      sessionId: SESSION_ID,
      message: ownerTextMessage({ messageId: 'msg_1', text: 'Oi' }),
      workingDirectory: fakeClients.workingDirectory,
    });

    const runs = await fakeClients.readRuns();
    expect(result).toEqual({ outcome: ConnectorWakeOutcome.Answered, exitCode: 0 });
    expect(runs).toHaveLength(1);
    expect(runAt({ runs, index: 0 })).toMatchObject({ clientName: CUSTOM_COMMAND, probe: PROBE_VALUE, hadConnectionUrl: false });
    expect(runAt({ runs, index: 0 }).argv[0]).toBe(CUSTOM_ARGUMENT);
    expect(runAt({ runs, index: 0 }).argv).toContain(SESSION_ID);
  });
});
