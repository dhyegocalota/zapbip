import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { CONNECTOR_RUNTIMES, ConnectorClient, isMissingEntry } from '@zapbip/agents/connector';
import { CONNECTOR_CONFIG_FILE_NAME, CONNECTOR_CONFIG_VARIABLE, CONNECTOR_WAKE_TIMEOUT_MS } from '@zapbip/types';

const CONFIG_ENCODING = 'utf8';

const agentConfigSchema = z.strictObject({
  command: z.string().min(1).describe('The program the connector starts instead of the default one, such as ccs.').optional(),
  args: z.array(z.string()).describe('Arguments placed before the ones the connector adds to start or resume the session.').optional(),
  environment: z.record(z.string(), z.string()).describe('Extra environment variables for the program.').optional(),
  timeoutMilliseconds: z.number().int().positive().describe('How long one wake may run before the connector stops it.').optional(),
});

export const connectorConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  agents: z
    .partialRecord(z.enum(ConnectorClient), agentConfigSchema)
    .describe('Overrides per connector client. Each key is a client id, and the fields of the entry replace the defaults.')
    .optional(),
});

export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;

export function connectorConfigJsonSchema(): object {
  return z.toJSONSchema(connectorConfigSchema);
}
export type ConnectorLaunch = {
  command: string;
  args: string[];
  environment: Record<string, string>;
  timeoutMilliseconds: number;
};

async function isExistingFile(input: { path: string }): Promise<boolean> {
  try {
    return (await stat(input.path)).isFile();
  } catch (error) {
    if (isMissingEntry({ error })) return false;
    throw error;
  }
}

export async function resolveConnectorConfigPath(input: {
  flagPath: string | null;
  environment: NodeJS.ProcessEnv;
  workingDirectory: string;
}): Promise<string | null> {
  const { flagPath, environment, workingDirectory } = input;
  const environmentPath = environment[CONNECTOR_CONFIG_VARIABLE];
  const isEnvironmentPathSet = environmentPath !== undefined && environmentPath !== '';
  if (flagPath !== null) return flagPath;
  if (isEnvironmentPathSet) return environmentPath;
  const wakeDirectoryPath = join(workingDirectory, CONNECTOR_CONFIG_FILE_NAME);
  return (await isExistingFile({ path: wakeDirectoryPath })) ? wakeDirectoryPath : null;
}

async function readConfigText(input: { path: string }): Promise<string> {
  try {
    return await readFile(input.path, CONFIG_ENCODING);
  } catch (error) {
    if (isMissingEntry({ error })) throw new Error(`connector config not found: ${input.path}`);
    throw error;
  }
}

function parseJsonText(input: { path: string; text: string }): unknown {
  try {
    return JSON.parse(input.text);
  } catch {
    throw new Error(`connector config is not valid JSON: ${input.path}`);
  }
}

function parseConnectorConfig(input: { path: string; text: string }): ConnectorConfig {
  const parsed = connectorConfigSchema.safeParse(parseJsonText(input));
  if (!parsed.success) throw new Error(`invalid connector config ${input.path}:\n${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

export async function readConnectorConfig(input: { configPath: string | null }): Promise<ConnectorConfig> {
  const { configPath } = input;
  if (configPath === null) return {};
  return parseConnectorConfig({ path: configPath, text: await readConfigText({ path: configPath }) });
}

export function launchOf(input: { config: ConnectorConfig; client: ConnectorClient }): ConnectorLaunch {
  const builtIn: ConnectorLaunch = {
    command: CONNECTOR_RUNTIMES[input.client].binaryName,
    args: [],
    environment: {},
    timeoutMilliseconds: CONNECTOR_WAKE_TIMEOUT_MS,
  };
  return { ...builtIn, ...input.config.agents?.[input.client] };
}
