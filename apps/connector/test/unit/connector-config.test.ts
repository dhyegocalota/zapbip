import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONNECTOR_RUNTIMES } from '@zapbip/agents/connector';
import { CONNECTOR_CONFIG_FILE_NAME, CONNECTOR_CONFIG_VARIABLE, CONNECTOR_WAKE_TIMEOUT_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectorConfigJsonSchema, launchOf, readConnectorConfig, resolveConnectorConfigPath } from '../../src/connector-config';
import { CONNECTOR_CLIENTS, SUBJECT_CLIENT } from '../support/connector-clients';

const SCHEMA_FILE = join(import.meta.dirname, '../../../docs/schemas/connector-config.json');
const CUSTOM_COMMAND = 'ccs';
const CUSTOM_ARGUMENT = '--some-flag';
const CUSTOM_TIMEOUT_MS = 60_000;
const CUSTOM_ENVIRONMENT = { CUSTOM_PROFILE: 'work' };
const FLAG_FILE_NAME = 'flag.json';
const VARIABLE_FILE_NAME = 'variable.json';
const CONFIG_FOR_SUBJECT = { agents: { [SUBJECT_CLIENT]: { command: CUSTOM_COMMAND, args: [CUSTOM_ARGUMENT] } } };

let rootDirectory: string;
let workingDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-connector-config-'));
  workingDirectory = join(rootDirectory, 'project');
  await mkdir(workingDirectory, { recursive: true });
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

async function writeFileIn(input: { directory: string; name: string; text: string }): Promise<string> {
  const path = join(input.directory, input.name);
  await writeFile(path, input.text);
  return path;
}

describe('resolveConnectorConfigPath', () => {
  it('prefers the flag over the variable and over the file in the working directory', async () => {
    const flagPath = await writeFileIn({ directory: rootDirectory, name: FLAG_FILE_NAME, text: '{}' });
    const variablePath = await writeFileIn({ directory: rootDirectory, name: VARIABLE_FILE_NAME, text: '{}' });
    await writeFileIn({ directory: workingDirectory, name: CONNECTOR_CONFIG_FILE_NAME, text: '{}' });

    const resolved = await resolveConnectorConfigPath({
      flagPath,
      environment: { [CONNECTOR_CONFIG_VARIABLE]: variablePath },
      workingDirectory,
    });

    expect(resolved).toBe(flagPath);
  });

  it('prefers the variable over the file in the working directory', async () => {
    const variablePath = await writeFileIn({ directory: rootDirectory, name: VARIABLE_FILE_NAME, text: '{}' });
    await writeFileIn({ directory: workingDirectory, name: CONNECTOR_CONFIG_FILE_NAME, text: '{}' });

    const resolved = await resolveConnectorConfigPath({
      flagPath: null,
      environment: { [CONNECTOR_CONFIG_VARIABLE]: variablePath },
      workingDirectory,
    });

    expect(resolved).toBe(variablePath);
  });

  it('reads zapbip.json from the working directory when neither the flag nor the variable is set', async () => {
    const wakePath = await writeFileIn({ directory: workingDirectory, name: CONNECTOR_CONFIG_FILE_NAME, text: '{}' });

    const resolved = await resolveConnectorConfigPath({ flagPath: null, environment: {}, workingDirectory });

    expect(resolved).toBe(wakePath);
  });

  it('is null when no file is given and the working directory has none', async () => {
    expect(await resolveConnectorConfigPath({ flagPath: null, environment: {}, workingDirectory })).toBeNull();
  });

  it('ignores an empty variable and falls through to the file in the working directory', async () => {
    const wakePath = await writeFileIn({ directory: workingDirectory, name: CONNECTOR_CONFIG_FILE_NAME, text: '{}' });

    const resolved = await resolveConnectorConfigPath({
      flagPath: null,
      environment: { [CONNECTOR_CONFIG_VARIABLE]: '' },
      workingDirectory,
    });

    expect(resolved).toBe(wakePath);
  });

  it('ignores a directory named zapbip.json in the working directory', async () => {
    await mkdir(join(workingDirectory, CONNECTOR_CONFIG_FILE_NAME));

    expect(await resolveConnectorConfigPath({ flagPath: null, environment: {}, workingDirectory })).toBeNull();
  });
});

describe('readConnectorConfig', () => {
  it('is empty when no config path is given', async () => {
    expect(await readConnectorConfig({ configPath: null })).toEqual({});
  });

  it('reads the override of each agent, and accepts the schema key', async () => {
    const configPath = await writeFileIn({
      directory: rootDirectory,
      name: FLAG_FILE_NAME,
      text: JSON.stringify({
        $schema: 'https://docs.zapbip.com/schemas/connector-config.json',
        agents: {
          [SUBJECT_CLIENT]: {
            command: CUSTOM_COMMAND,
            args: [CUSTOM_ARGUMENT],
            environment: CUSTOM_ENVIRONMENT,
            timeoutMilliseconds: CUSTOM_TIMEOUT_MS,
          },
        },
      }),
    });

    expect(await readConnectorConfig({ configPath })).toEqual({
      $schema: 'https://docs.zapbip.com/schemas/connector-config.json',
      agents: {
        [SUBJECT_CLIENT]: {
          command: CUSTOM_COMMAND,
          args: [CUSTOM_ARGUMENT],
          environment: CUSTOM_ENVIRONMENT,
          timeoutMilliseconds: CUSTOM_TIMEOUT_MS,
        },
      },
    });
  });

  it('names the file when it is not JSON', async () => {
    const configPath = await writeFileIn({ directory: rootDirectory, name: FLAG_FILE_NAME, text: '{ not json' });

    await expect(readConnectorConfig({ configPath })).rejects.toThrow(`connector config is not valid JSON: ${configPath}`);
  });

  it('names the file when it does not exist', async () => {
    const configPath = join(rootDirectory, 'missing.json');

    await expect(readConnectorConfig({ configPath })).rejects.toThrow(`connector config not found: ${configPath}`);
  });

  it.each([
    ['an agent id no runtime declares', { agents: { 'not-an-agent': { command: CUSTOM_COMMAND } } }],
    ['an unknown field of an agent', { agents: { [SUBJECT_CLIENT]: { model: 'opus' } } }],
    ['an unknown top-level field', { agent: {} }],
    ['args that are not strings', { agents: { [SUBJECT_CLIENT]: { args: [1] } } }],
    ['an empty command', { agents: { [SUBJECT_CLIENT]: { command: '' } } }],
    ['a timeout that is not a positive integer', { agents: { [SUBJECT_CLIENT]: { timeoutMilliseconds: 0 } } }],
  ])('refuses %s with a validation error', async (_label, content) => {
    const configPath = await writeFileIn({ directory: rootDirectory, name: FLAG_FILE_NAME, text: JSON.stringify(content) });

    await expect(readConnectorConfig({ configPath })).rejects.toThrow(`invalid connector config ${configPath}`);
  });
});

describe.each(CONNECTOR_CLIENTS)('launchOf the %s client', (client) => {
  it('is the runtime binary, no extra arguments or environment, and the wake timeout when the config names no agent', () => {
    expect(launchOf({ config: {}, client })).toEqual({
      command: CONNECTOR_RUNTIMES[client].binaryName,
      args: [],
      environment: {},
      timeoutMilliseconds: CONNECTOR_WAKE_TIMEOUT_MS,
    });
  });

  it('keeps the runtime defaults for every field the agent entry leaves out', () => {
    const config = { agents: { [client]: { command: CUSTOM_COMMAND } } };

    expect(launchOf({ config, client })).toEqual({
      command: CUSTOM_COMMAND,
      args: [],
      environment: {},
      timeoutMilliseconds: CONNECTOR_WAKE_TIMEOUT_MS,
    });
  });

  it('takes the command, arguments, environment and timeout the agent entry names', () => {
    const config = {
      agents: {
        [client]: {
          command: CUSTOM_COMMAND,
          args: [CUSTOM_ARGUMENT],
          environment: CUSTOM_ENVIRONMENT,
          timeoutMilliseconds: CUSTOM_TIMEOUT_MS,
        },
      },
    };

    expect(launchOf({ config, client })).toEqual({
      command: CUSTOM_COMMAND,
      args: [CUSTOM_ARGUMENT],
      environment: CUSTOM_ENVIRONMENT,
      timeoutMilliseconds: CUSTOM_TIMEOUT_MS,
    });
  });
});

describe('launchOf across clients', () => {
  it('leaves every other client on its defaults', () => {
    const otherClients = CONNECTOR_CLIENTS.filter((client) => client !== SUBJECT_CLIENT);

    otherClients.forEach((client) => {
      expect(launchOf({ config: CONFIG_FOR_SUBJECT, client }).command).toBe(CONNECTOR_RUNTIMES[client].binaryName);
    });
    expect(launchOf({ config: CONFIG_FOR_SUBJECT, client: SUBJECT_CLIENT }).command).toBe(CUSTOM_COMMAND);
  });
});

describe('connectorConfigJsonSchema', () => {
  it('is the schema committed for the docs site, so editors complete the file the connector reads', async () => {
    expect(JSON.parse(await readFile(SCHEMA_FILE, 'utf8'))).toEqual(connectorConfigJsonSchema());
  });
});
