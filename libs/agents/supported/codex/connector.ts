import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parse } from 'smol-toml';
import { SESSION_LOOKUP_LIMIT, STDIN_PROMPT_ARGUMENT, UUID_PATTERN, WakeRefusalKind, ZAPBIP_SERVER_NAME } from '@zapbip/types';
import {
  StrictMcpNullReason,
  type AgentConnectorRuntime,
  type SessionLookupInput,
  type WakeIsolation,
  type WakeIsolationInput,
} from '../../src/contract';
import { assertSessionId } from '../../src/connector-support/session-id';
import { isMissingEntry } from '../../src/connector-support/missing-entry';
import { listDirectory } from '../../src/connector-support/list-directory';
import { WakeIsolationRefusedError } from '../../src/connector-support/wake-isolation-refused-error';

type SessionMeta = { sessionId: string; workingDirectory: string };

const BINARY_NAME = 'codex';
const SESSIONS_FOLDER = 'sessions';
const ROLLOUT_PATTERN = /(^|\/)rollout-[^/]+\.jsonl$/;
const SESSION_META_TYPE = 'session_meta';
const ALLOWED_TOOL_NAME = 'send_message';
const WEB_SEARCH_DISABLED_CONFIGURATION = 'web_search="disabled"';
const APPROVAL_MODE = 'approve';
const ACTIVE_WRITER_MESSAGE = 'thread already has an active writer';
const SERVER_CONFIGURATION_PREFIX = `mcp_servers.${ZAPBIP_SERVER_NAME}`;
const SAFETY_ARGUMENTS = [
  'exec',
  '--skip-git-repo-check',
  '-s',
  'read-only',
  '-c',
  `${SERVER_CONFIGURATION_PREFIX}.default_tools_approval_mode="${APPROVAL_MODE}"`,
  '-c',
  `${SERVER_CONFIGURATION_PREFIX}.enabled_tools=["${ALLOWED_TOOL_NAME}"]`,
  '-c',
  WEB_SEARCH_DISABLED_CONFIGURATION,
];
const HOME_FOLDER = '.codex';
const HOME_VARIABLE = 'CODEX_HOME';
const CODEX_CONFIG_FILE_NAME = 'config.toml';
const CODEX_MANAGED_CONFIG_FILE_NAME = 'managed_config.toml';
const CODEX_SYSTEM_CONFIG_DIRECTORY = '/etc/codex';
const MANAGED_ALLOWED_KEYS = ['model', 'model_reasoning_effort', 'model_reasoning_summary', 'file_opener', 'hide_agent_reasoning'];
const PROFILE_ALLOWED_KEYS = [...MANAGED_ALLOWED_KEYS, 'web_search', 'mcp_servers'];
const WEB_SEARCH_KEY_FRAGMENT = 'web_search';
const LEGACY_TOOLS_WEB_SEARCH_KEY = 'tools_web_search';
const BARE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

async function readFirstLine(input: { path: string }): Promise<string | null> {
  const stream = createReadStream(input.path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    const first = await lines[Symbol.asyncIterator]().next();
    if (first.done) return null;
    return first.value;
  } finally {
    lines.close();
    stream.destroy();
  }
}

function asRecord(input: { value: unknown }): Record<string, unknown> | null {
  if (typeof input.value !== 'object' || input.value === null) return null;
  return input.value as Record<string, unknown>;
}

function parseSessionMeta(input: { line: string }): SessionMeta | null {
  try {
    const entry = asRecord({ value: JSON.parse(input.line) });
    if (entry === null || entry.type !== SESSION_META_TYPE) return null;
    const payload = asRecord({ value: entry.payload });
    if (payload === null) return null;
    const { id, cwd } = payload;
    if (typeof id !== 'string' || typeof cwd !== 'string') return null;
    return { sessionId: id, workingDirectory: cwd };
  } catch {
    return null;
  }
}

async function readSessionMeta(input: { path: string }): Promise<SessionMeta | null> {
  const firstLine = await readFirstLine(input);
  if (firstLine === null) return null;
  return parseSessionMeta({ line: firstLine });
}

async function findNewestSessionId(input: SessionLookupInput): Promise<string | null> {
  const root = join(input.homeDirectory, SESSIONS_FOLDER);
  const relativePaths = await listDirectory({ directory: root, recursive: true });
  const newestRollouts = relativePaths
    .filter((relativePath) => ROLLOUT_PATTERN.test(relativePath))
    .sort()
    .reverse()
    .slice(0, SESSION_LOOKUP_LIMIT);
  const sessionMetas = await Promise.all(newestRollouts.map((relativePath) => readSessionMeta({ path: join(root, relativePath) })));
  const match = sessionMetas.find(
    (meta) => meta !== null && meta.workingDirectory === input.workingDirectory && UUID_PATTERN.test(meta.sessionId),
  );
  if (match === undefined || match === null) return null;
  return match.sessionId;
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

function codexConfigFilesOf(input: { workingDirectory: string; homeDirectory: string; systemConfigDirectory: string }): ConfigFile[] {
  const { workingDirectory, homeDirectory, systemConfigDirectory } = input;
  const projectFiles = ancestorsOf({ directory: resolve(workingDirectory) }).map((directory) => ({
    file: join(directory, HOME_FOLDER, CODEX_CONFIG_FILE_NAME),
    layer: CodexConfigLayer.Other,
  }));
  const layerFiles = [
    { file: join(systemConfigDirectory, CODEX_CONFIG_FILE_NAME), layer: CodexConfigLayer.Other },
    { file: join(systemConfigDirectory, CODEX_MANAGED_CONFIG_FILE_NAME), layer: CodexConfigLayer.Managed },
    { file: join(homeDirectory, CODEX_CONFIG_FILE_NAME), layer: CodexConfigLayer.Home },
    { file: join(homeDirectory, CODEX_MANAGED_CONFIG_FILE_NAME), layer: CodexConfigLayer.Managed },
  ];
  return [...new Map([...layerFiles, ...projectFiles].map((configFile) => [configFile.file, configFile])).values()];
}

function isUrlServer(input: { definition: TomlTable }): boolean {
  return typeof input.definition.url === 'string' && input.definition.command === undefined;
}

function assertLayerRules(input: { layer: CodexConfigLayer; references: ServerReference[] }): void {
  const { layer, references } = input;
  const zapbipReferences = references.filter((reference) => reference.name === ZAPBIP_SERVER_NAME);
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
  return ['-c', `profiles.${keyOf({ name: input.profile })}.${WEB_SEARCH_DISABLED_CONFIGURATION}`];
}

async function prepareIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const { workingDirectory, homeDirectory, systemConfigDirectory = CODEX_SYSTEM_CONFIG_DIRECTORY } = input;
  const configFiles = codexConfigFilesOf({ workingDirectory, homeDirectory, systemConfigDirectory });
  const findings = await Promise.all(configFiles.map((configFile) => findingsOfConfigFile({ configFile })));
  const references = findings.flatMap((finding) => finding.references);
  const profileNames = [...new Set(findings.flatMap((finding) => finding.profileNames))];
  const isZapbipAtTopLevel = (reference: ServerReference) => reference.profile === null && reference.name === ZAPBIP_SERVER_NAME;
  const disabledArguments = references
    .filter((reference) => !isZapbipAtTopLevel(reference))
    .map((reference) => disabledServerArguments({ reference }));
  const uniqueArguments = [...new Map(disabledArguments.map((pair) => [pair[1], pair])).values()];
  const webSearchArguments = profileNames.map((profile) => disabledWebSearchArguments({ profile }));
  return { isolationArguments: [...uniqueArguments, ...webSearchArguments].flat(), cleanup: async () => undefined };
}

function resumeArguments(input: { sessionId: string; isolationArguments: string[] }): string[] {
  assertSessionId({ sessionId: input.sessionId });
  return [...SAFETY_ARGUMENTS, ...input.isolationArguments, 'resume', input.sessionId, STDIN_PROMPT_ARGUMENT];
}

function newSessionArguments(input: { isolationArguments: string[] }): string[] {
  return [...SAFETY_ARGUMENTS, ...input.isolationArguments, STDIN_PROMPT_ARGUMENT];
}

export const runtime: AgentConnectorRuntime = {
  binaryName: BINARY_NAME,
  homeFolder: HOME_FOLDER,
  homeVariable: HOME_VARIABLE,
  strictMcpArgument: null,
  strictMcpNullReason: StrictMcpNullReason.DisablesOtherServers,
  findNewestSessionId,
  resumeArguments,
  newSessionArguments,
  prepareIsolation,
  isNewSessionFallback: ({ stderrText }) => stderrText.includes(ACTIVE_WRITER_MESSAGE),
};
