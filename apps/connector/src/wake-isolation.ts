import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { CLAUDE_MCP_SERVER_TYPE, CODEX_ZAPBIP_SERVER_NAME, ConnectorClient } from '@zapbip/types';

export class WakeIsolationRefusedError extends Error {}

export type WakeIsolation = { isolationArguments: string[]; cleanup: () => Promise<void> };
export type WakeIsolationInput = { connectionLink: string; workingDirectory: string; codexHome?: string; systemConfigDirectory?: string };

export async function removeStaleWakeDirectories(input: { nowMs?: number } = {}): Promise<void> {
  throw new Error('removeStaleWakeDirectories is not implemented');
}

const CLAUDE_STRICT_MCP_ARGUMENT = '--strict-mcp-config';
const CLAUDE_MCP_CONFIG_ARGUMENT = '--mcp-config=';
const CLAUDE_NO_SETTING_SOURCES_ARGUMENT = '--setting-sources=';
const WAKE_DIRECTORY_PREFIX = 'zapbip-wake-';
const MCP_CONFIG_FILE_NAME = 'mcp.json';
const OWNER_ONLY_FILE_MODE = 0o600;
const CODEX_CONFIG_FOLDER = '.codex';
const CODEX_CONFIG_FILE_NAME = 'config.toml';
const UNQUOTABLE_KEY_PATTERN = /["\\\u0000-\u001f]/;
const UNPARSEABLE_CONFIG_REASON = 'a Codex configuration file is not valid TOML';
const UNIDENTIFIABLE_SERVER_REASON = 'a Codex MCP server in the configuration cannot be identified';
const BARE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const MISSING_ENTRY_CODE = 'ENOENT';

async function prepareClaudeIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const directory = await mkdtemp(join(tmpdir(), WAKE_DIRECTORY_PREFIX));
  const configFile = join(directory, MCP_CONFIG_FILE_NAME);
  const config = { mcpServers: { [CODEX_ZAPBIP_SERVER_NAME]: { type: CLAUDE_MCP_SERVER_TYPE, url: input.connectionLink } } };
  await writeFile(configFile, JSON.stringify(config), { mode: OWNER_ONLY_FILE_MODE });
  return {
    isolationArguments: [CLAUDE_STRICT_MCP_ARGUMENT, `${CLAUDE_MCP_CONFIG_ARGUMENT}${configFile}`, CLAUDE_NO_SETTING_SOURCES_ARGUMENT],
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

async function readTextOrEmpty(input: { file: string }): Promise<string> {
  try {
    return await readFile(input.file, 'utf8');
  } catch (error) {
    const isMissing = error instanceof Error && 'code' in error && error.code === MISSING_ENTRY_CODE;
    if (isMissing) return '';
    throw error;
  }
}

type TomlTable = Record<string, unknown>;
type ServerReference = { profile: string | null; name: string };

function refuse(input: { reason: string }): never {
  throw new WakeIsolationRefusedError(input.reason);
}

function isTable(value: unknown): value is TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseConfig(input: { text: string }): TomlTable {
  try {
    return parse(input.text);
  } catch {
    return refuse({ reason: UNPARSEABLE_CONFIG_REASON });
  }
}

function tableOrRefuse(input: { value: unknown }): TomlTable {
  if (!isTable(input.value)) return refuse({ reason: UNIDENTIFIABLE_SERVER_REASON });
  return input.value;
}

function serversOf(input: { table: TomlTable; profile: string | null }): ServerReference[] {
  const { table, profile } = input;
  if (table.mcp_servers === undefined) return [];
  const servers = tableOrRefuse({ value: table.mcp_servers });
  return Object.entries(servers).map(([name, definition]) => {
    tableOrRefuse({ value: definition });
    return { profile, name };
  });
}

function profileTablesOf(input: { config: TomlTable }): [string, TomlTable][] {
  if (input.config.profiles === undefined) return [];
  const profiles = tableOrRefuse({ value: input.config.profiles });
  return Object.entries(profiles).map(([name, profile]) => [name, tableOrRefuse({ value: profile })]);
}

function serverReferencesOf(input: { text: string }): ServerReference[] {
  const config = parseConfig(input);
  const profileReferences = profileTablesOf({ config }).flatMap(([profile, table]) => serversOf({ table, profile }));
  return [...serversOf({ table: config, profile: null }), ...profileReferences];
}

function keyOf(input: { name: string }): string {
  if (BARE_KEY_PATTERN.test(input.name)) return input.name;
  if (UNQUOTABLE_KEY_PATTERN.test(input.name)) return refuse({ reason: UNIDENTIFIABLE_SERVER_REASON });
  return `"${input.name}"`;
}

function disabledServerArguments(input: { reference: ServerReference }): string[] {
  const { profile, name } = input.reference;
  const serverKey = `mcp_servers.${keyOf({ name })}`;
  const configKey = profile === null ? serverKey : `profiles.${keyOf({ name: profile })}.${serverKey}`;
  return ['-c', `${configKey}.enabled=false`];
}

async function prepareCodexIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const { workingDirectory, codexHome = join(homedir(), CODEX_CONFIG_FOLDER) } = input;
  const configFiles = [join(codexHome, CODEX_CONFIG_FILE_NAME), join(workingDirectory, CODEX_CONFIG_FOLDER, CODEX_CONFIG_FILE_NAME)];
  const texts = await Promise.all(configFiles.map((file) => readTextOrEmpty({ file })));
  const references = texts.flatMap((text) => serverReferencesOf({ text }));
  const isZapbipAtTopLevel = (reference: ServerReference) => reference.profile === null && reference.name === CODEX_ZAPBIP_SERVER_NAME;
  const disabledArguments = references
    .filter((reference) => !isZapbipAtTopLevel(reference))
    .map((reference) => disabledServerArguments({ reference }));
  const uniqueArguments = [...new Map(disabledArguments.map((pair) => [pair[1], pair])).values()];
  return { isolationArguments: uniqueArguments.flat(), cleanup: async () => undefined };
}

export const WAKE_ISOLATION_PREPARERS: Record<ConnectorClient, (input: WakeIsolationInput) => Promise<WakeIsolation>> = {
  [ConnectorClient.ClaudeCode]: prepareClaudeIsolation,
  [ConnectorClient.Codex]: prepareCodexIsolation,
};
