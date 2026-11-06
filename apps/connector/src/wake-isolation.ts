import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLAUDE_MCP_SERVER_TYPE, CODEX_ZAPBIP_SERVER_NAME, ConnectorClient } from '@zapbip/types';

export type WakeIsolation = { isolationArguments: string[]; cleanup: () => Promise<void> };
export type WakeIsolationInput = { connectionLink: string; workingDirectory: string; codexHome?: string };

const CLAUDE_STRICT_MCP_ARGUMENT = '--strict-mcp-config';
const CLAUDE_MCP_CONFIG_ARGUMENT = '--mcp-config=';
const CLAUDE_NO_SETTING_SOURCES_ARGUMENT = '--setting-sources=';
const WAKE_DIRECTORY_PREFIX = 'zapbip-wake-';
const MCP_CONFIG_FILE_NAME = 'mcp.json';
const OWNER_ONLY_FILE_MODE = 0o600;
const CODEX_CONFIG_FOLDER = '.codex';
const CODEX_CONFIG_FILE_NAME = 'config.toml';
const CODEX_SERVER_TABLE_PATTERN = /^\s*\[?mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))[\].]/gm;
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

function serverNamesOf(input: { text: string }): string[] {
  return [...input.text.matchAll(CODEX_SERVER_TABLE_PATTERN)].map((match) => match.slice(1).find((group) => group !== undefined) as string);
}

function disabledServerArguments(input: { name: string }): string[] {
  const key = BARE_KEY_PATTERN.test(input.name) ? input.name : `"${input.name}"`;
  return ['-c', `mcp_servers.${key}.enabled=false`];
}

async function prepareCodexIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const { workingDirectory, codexHome = join(homedir(), CODEX_CONFIG_FOLDER) } = input;
  const configFiles = [join(codexHome, CODEX_CONFIG_FILE_NAME), join(workingDirectory, CODEX_CONFIG_FOLDER, CODEX_CONFIG_FILE_NAME)];
  const texts = await Promise.all(configFiles.map((file) => readTextOrEmpty({ file })));
  const names = [...new Set(texts.flatMap((text) => serverNamesOf({ text })))].filter((name) => name !== CODEX_ZAPBIP_SERVER_NAME);
  return { isolationArguments: names.flatMap((name) => disabledServerArguments({ name })), cleanup: async () => undefined };
}

export const WAKE_ISOLATION_PREPARERS: Record<ConnectorClient, (input: WakeIsolationInput) => Promise<WakeIsolation>> = {
  [ConnectorClient.ClaudeCode]: prepareClaudeIsolation,
  [ConnectorClient.Codex]: prepareCodexIsolation,
};
