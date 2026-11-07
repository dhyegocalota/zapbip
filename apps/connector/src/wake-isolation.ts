import type { Stats } from 'node:fs';
import { lstat, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'smol-toml';
import {
  CLAUDE_MCP_SERVER_TYPE,
  CODEX_WEB_SEARCH_DISABLED_CONFIGURATION,
  CODEX_ZAPBIP_SERVER_NAME,
  CONNECTOR_KILL_GRACE_MS,
  CONNECTOR_WAKE_TIMEOUT_MS,
  ConnectorClient,
  WakeRefusalKind,
} from '@zapbip/types';

export class WakeIsolationRefusedError extends Error {
  constructor(readonly kind: WakeRefusalKind) {
    super(kind);
  }
}

export type WakeIsolation = { isolationArguments: string[]; cleanup: () => Promise<void> };
export type WakeIsolationInput = { connectionLink: string; workingDirectory: string; codexHome?: string; systemConfigDirectory?: string };

export async function removeStaleWakeDirectories(input: { nowMs?: number; userId?: number } = {}): Promise<void> {
  const { nowMs = Date.now(), userId = process.getuid?.() } = input;
  const temporaryDirectory = tmpdir();
  const names = (await readdir(temporaryDirectory)).filter((name) => name.startsWith(WAKE_DIRECTORY_PREFIX));
  await Promise.all(
    names.map(async (name) => {
      const directory = join(temporaryDirectory, name);
      const status = await statusOrNull({ directory });
      if (status === null) return;
      const isStaleOwnDirectory = status.isDirectory() && status.uid === userId && nowMs - status.mtimeMs > STALE_WAKE_DIRECTORY_AGE_MS;
      if (isStaleOwnDirectory) await rm(directory, { recursive: true, force: true });
    }),
  );
}

const CLAUDE_STRICT_MCP_ARGUMENT = '--strict-mcp-config';
const CLAUDE_MCP_CONFIG_ARGUMENT = '--mcp-config=';
const CLAUDE_NO_SETTING_SOURCES_ARGUMENT = '--setting-sources=';
const WAKE_DIRECTORY_PREFIX = 'zapbip-wake-';
const MCP_CONFIG_FILE_NAME = 'mcp.json';
const OWNER_ONLY_FILE_MODE = 0o600;
const CODEX_CONFIG_FOLDER = '.codex';
const CODEX_CONFIG_FILE_NAME = 'config.toml';
const CODEX_MANAGED_CONFIG_FILE_NAME = 'managed_config.toml';
const CODEX_SYSTEM_CONFIG_DIRECTORY = '/etc/codex';
const STALE_WAKE_DIRECTORY_AGE_MS = CONNECTOR_WAKE_TIMEOUT_MS + CONNECTOR_KILL_GRACE_MS;
const MANAGED_ALLOWED_KEYS = ['model', 'model_reasoning_effort', 'model_reasoning_summary', 'file_opener', 'hide_agent_reasoning'];
const PROFILE_ALLOWED_KEYS = [...MANAGED_ALLOWED_KEYS, 'web_search', 'mcp_servers'];
const WEB_SEARCH_KEY_FRAGMENT = 'web_search';
const LEGACY_TOOLS_WEB_SEARCH_KEY = 'tools_web_search';
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

function isMissingEntry(input: { error: unknown }): boolean {
  return input.error instanceof Error && 'code' in input.error && input.error.code === MISSING_ENTRY_CODE;
}

async function statusOrNull(input: { directory: string }): Promise<Stats | null> {
  try {
    return await lstat(input.directory);
  } catch (error) {
    if (isMissingEntry({ error })) return null;
    throw error;
  }
}

async function readTextOrEmpty(input: { file: string }): Promise<string> {
  try {
    return await readFile(input.file, 'utf8');
  } catch (error) {
    if (isMissingEntry({ error })) return '';
    return refuse({ kind: WakeRefusalKind.Unreadable });
  }
}

type TomlTable = Record<string, unknown>;
type ServerReference = { profile: string | null; name: string; definition: TomlTable };
type ConfigFile = { file: string; layer: CodexConfigLayer };

enum CodexConfigLayer {
  Home = 'home',
  Managed = 'managed',
  Other = 'other',
}

function refuse(input: { kind: WakeRefusalKind }): never {
  throw new WakeIsolationRefusedError(input.kind);
}

function isTable(value: unknown): value is TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseConfig(input: { text: string }): TomlTable {
  try {
    return parse(input.text);
  } catch {
    return refuse({ kind: WakeRefusalKind.Unparseable });
  }
}

function tableOrRefuse(input: { value: unknown }): TomlTable {
  if (!isTable(input.value)) return refuse({ kind: WakeRefusalKind.UnidentifiableServer });
  return input.value;
}

function serversOf(input: { table: TomlTable; profile: string | null }): ServerReference[] {
  const { table, profile } = input;
  if (table.mcp_servers === undefined) return [];
  const servers = tableOrRefuse({ value: table.mcp_servers });
  return Object.entries(servers).map(([name, definition]) => ({ profile, name, definition: tableOrRefuse({ value: definition }) }));
}

function profileTablesOf(input: { config: TomlTable }): [string, TomlTable][] {
  if (input.config.profiles === undefined) return [];
  const profiles = tableOrRefuse({ value: input.config.profiles });
  return Object.entries(profiles).map(([name, profile]) => [name, tableOrRefuse({ value: profile })]);
}

type ConfigFindings = { references: ServerReference[]; profileNames: string[] };

function assertManagedAllowlist(input: { config: TomlTable }): void {
  const hasUnlistedKey = Object.keys(input.config).some((key) => !MANAGED_ALLOWED_KEYS.includes(key));
  if (hasUnlistedKey) refuse({ kind: WakeRefusalKind.ManagedKey });
}

function assertProfileCanBeIsolated(input: { table: TomlTable }): void {
  const hasUnlistedKey = Object.keys(input.table).some((key) => !PROFILE_ALLOWED_KEYS.includes(key));
  if (hasUnlistedKey) refuse({ kind: WakeRefusalKind.ProfileKey });
}

function assertNoLegacyWebSearch(input: { config: TomlTable }): void {
  const { features, tools } = input.config;
  const hasFeatureSwitch = isTable(features) && Object.keys(features).some((key) => key.includes(WEB_SEARCH_KEY_FRAGMENT));
  const hasToolSwitch = isTable(tools) && WEB_SEARCH_KEY_FRAGMENT in tools;
  const hasLegacyKey = LEGACY_TOOLS_WEB_SEARCH_KEY in input.config;
  if (hasFeatureSwitch || hasToolSwitch || hasLegacyKey) refuse({ kind: WakeRefusalKind.LegacyWebSearch });
}

function keyOf(input: { name: string }): string {
  if (!BARE_KEY_PATTERN.test(input.name)) return refuse({ kind: WakeRefusalKind.UnidentifiableServer });
  return input.name;
}

function disabledServerArguments(input: { reference: ServerReference }): string[] {
  const { profile, name } = input.reference;
  const serverKey = `mcp_servers.${keyOf({ name })}`;
  const configKey = profile === null ? serverKey : `profiles.${keyOf({ name: profile })}.${serverKey}`;
  return ['-c', `${configKey}.enabled=false`];
}

function ancestorsOf(input: { directory: string }): string[] {
  const parent = dirname(input.directory);
  if (parent === input.directory) return [input.directory];
  return [input.directory, ...ancestorsOf({ directory: parent })];
}

function codexConfigFilesOf(input: { workingDirectory: string; codexHome: string; systemConfigDirectory: string }): ConfigFile[] {
  const { workingDirectory, codexHome, systemConfigDirectory } = input;
  const projectFiles = ancestorsOf({ directory: resolve(workingDirectory) }).map((directory) => ({
    file: join(directory, CODEX_CONFIG_FOLDER, CODEX_CONFIG_FILE_NAME),
    layer: CodexConfigLayer.Other,
  }));
  const layerFiles = [
    { file: join(systemConfigDirectory, CODEX_CONFIG_FILE_NAME), layer: CodexConfigLayer.Other },
    { file: join(systemConfigDirectory, CODEX_MANAGED_CONFIG_FILE_NAME), layer: CodexConfigLayer.Managed },
    { file: join(codexHome, CODEX_CONFIG_FILE_NAME), layer: CodexConfigLayer.Home },
    { file: join(codexHome, CODEX_MANAGED_CONFIG_FILE_NAME), layer: CodexConfigLayer.Managed },
  ];
  return [...new Map([...layerFiles, ...projectFiles].map((configFile) => [configFile.file, configFile])).values()];
}

function isUrlServer(input: { definition: TomlTable }): boolean {
  return typeof input.definition.url === 'string' && input.definition.command === undefined;
}

function assertLayerRules(input: { layer: CodexConfigLayer; references: ServerReference[] }): void {
  const { layer, references } = input;
  const zapbipReferences = references.filter((reference) => reference.name === CODEX_ZAPBIP_SERVER_NAME);
  const isZapbipOutsideHome = layer !== CodexConfigLayer.Home && zapbipReferences.length > 0;
  const isHomeZapbipUnsound = zapbipReferences.some((reference) => reference.profile !== null || !isUrlServer(reference));
  if (isZapbipOutsideHome) refuse({ kind: WakeRefusalKind.ZapbipRedefined });
  if (isHomeZapbipUnsound) refuse({ kind: WakeRefusalKind.ZapbipRedefined });
}

async function findingsOfConfigFile(input: { configFile: ConfigFile }): Promise<ConfigFindings> {
  const { file, layer } = input.configFile;
  const config = parseConfig({ text: await readTextOrEmpty({ file }) });
  if (layer === CodexConfigLayer.Managed) assertManagedAllowlist({ config });
  assertNoLegacyWebSearch({ config });
  const profiles = profileTablesOf({ config });
  profiles.forEach(([, table]) => assertProfileCanBeIsolated({ table }));
  const references = [
    ...serversOf({ table: config, profile: null }),
    ...profiles.flatMap(([profile, table]) => serversOf({ table, profile })),
  ];
  assertLayerRules({ layer, references });
  return { references, profileNames: profiles.map(([name]) => name) };
}

function disabledWebSearchArguments(input: { profile: string }): string[] {
  return ['-c', `profiles.${keyOf({ name: input.profile })}.${CODEX_WEB_SEARCH_DISABLED_CONFIGURATION}`];
}

async function prepareCodexIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const {
    workingDirectory,
    codexHome = join(homedir(), CODEX_CONFIG_FOLDER),
    systemConfigDirectory = CODEX_SYSTEM_CONFIG_DIRECTORY,
  } = input;
  const configFiles = codexConfigFilesOf({ workingDirectory, codexHome, systemConfigDirectory });
  const findings = await Promise.all(configFiles.map((configFile) => findingsOfConfigFile({ configFile })));
  const references = findings.flatMap((finding) => finding.references);
  const profileNames = [...new Set(findings.flatMap((finding) => finding.profileNames))];
  const isZapbipAtTopLevel = (reference: ServerReference) => reference.profile === null && reference.name === CODEX_ZAPBIP_SERVER_NAME;
  const disabledArguments = references
    .filter((reference) => !isZapbipAtTopLevel(reference))
    .map((reference) => disabledServerArguments({ reference }));
  const uniqueArguments = [...new Map(disabledArguments.map((pair) => [pair[1], pair])).values()];
  const webSearchArguments = profileNames.map((profile) => disabledWebSearchArguments({ profile }));
  return { isolationArguments: [...uniqueArguments, ...webSearchArguments].flat(), cleanup: async () => undefined };
}

export const WAKE_ISOLATION_PREPARERS: Record<ConnectorClient, (input: WakeIsolationInput) => Promise<WakeIsolation>> = {
  [ConnectorClient.ClaudeCode]: prepareClaudeIsolation,
  [ConnectorClient.Codex]: prepareCodexIsolation,
};
