import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UUID_PATTERN, WAKE_ALLOWED_TOOL, ZAPBIP_SERVER_NAME } from '@zapbip/types';
import type { AgentConnectorRuntime, SessionLookupInput, WakeIsolation, WakeIsolationInput } from '../../src/contract';
import { assertSessionId } from '../../src/connector-support/session-id';
import { listDirectory } from '../../src/connector-support/list-directory';
import { WAKE_DIRECTORY_PREFIX } from '../../src/connector-support/wake-directory';

type SessionFile = { sessionId: string; modifiedAtMs: number };

const BINARY_NAME = 'claude';
const HOME_FOLDER = '.claude';
const HOME_VARIABLE = 'CLAUDE_CONFIG_DIR';
const PROJECTS_FOLDER = 'projects';
const SESSION_EXTENSION = '.jsonl';
const NON_ALPHANUMERIC_PATTERN = /[^A-Za-z0-9]/g;
const PROJECT_FOLDER_SEPARATOR = '-';
const PERMISSION_MODE = 'dontAsk';
const MCP_SERVER_TYPE = 'http';
const SAFETY_ARGUMENTS = ['--permission-mode', PERMISSION_MODE, '--tools='];
const STRICT_MCP_ARGUMENT = '--strict-mcp-config';
const MCP_CONFIG_ARGUMENT = '--mcp-config=';
const NO_SETTING_SOURCES_ARGUMENT = '--setting-sources=';
const MCP_CONFIG_FILE_NAME = 'mcp.json';
const OWNER_ONLY_FILE_MODE = 0o600;

export function claudeProjectFolderName(input: { workingDirectory: string }): string {
  return input.workingDirectory.replace(NON_ALPHANUMERIC_PATTERN, PROJECT_FOLDER_SEPARATOR);
}

async function findNewestSessionId(input: SessionLookupInput): Promise<string | null> {
  const folder = join(input.homeDirectory, PROJECTS_FOLDER, claudeProjectFolderName(input));
  const fileNames = await listDirectory({ directory: folder, recursive: false });
  const candidateIds = fileNames
    .filter((fileName) => fileName.endsWith(SESSION_EXTENSION))
    .map((fileName) => fileName.slice(0, -SESSION_EXTENSION.length))
    .filter((sessionId) => UUID_PATTERN.test(sessionId));
  const sessionFiles: SessionFile[] = await Promise.all(
    candidateIds.map(async (sessionId) => ({
      sessionId,
      modifiedAtMs: (await stat(join(folder, `${sessionId}${SESSION_EXTENSION}`))).mtimeMs,
    })),
  );
  const [newest] = sessionFiles.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);
  if (newest === undefined) return null;
  return newest.sessionId;
}

function resumeArguments(input: { sessionId: string; isolationArguments: string[] }): string[] {
  assertSessionId({ sessionId: input.sessionId });
  return ['-p', '--resume', input.sessionId, ...SAFETY_ARGUMENTS, ...input.isolationArguments, `--allowedTools=${WAKE_ALLOWED_TOOL}`];
}

async function prepareIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const directory = await mkdtemp(join(tmpdir(), WAKE_DIRECTORY_PREFIX));
  const configFile = join(directory, MCP_CONFIG_FILE_NAME);
  const config = { mcpServers: { [ZAPBIP_SERVER_NAME]: { type: MCP_SERVER_TYPE, url: input.connectionLink } } };
  await writeFile(configFile, JSON.stringify(config), { mode: OWNER_ONLY_FILE_MODE });
  return {
    isolationArguments: [STRICT_MCP_ARGUMENT, `${MCP_CONFIG_ARGUMENT}${configFile}`, NO_SETTING_SOURCES_ARGUMENT],
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export const runtime: AgentConnectorRuntime = {
  binaryName: BINARY_NAME,
  homeFolder: HOME_FOLDER,
  homeVariable: HOME_VARIABLE,
  strictMcpArgument: STRICT_MCP_ARGUMENT,
  strictMcpNullReason: null,
  findNewestSessionId,
  resumeArguments,
  newSessionArguments: null,
  prepareIsolation,
  isNewSessionFallback: () => false,
};
