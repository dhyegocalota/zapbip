import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UUID_PATTERN, ZAPBIP_SERVER_NAME } from '@zapbip/types';
import type { AgentConnectorRuntime, SessionLookupInput, WakeIsolation, WakeIsolationInput } from '../../src/contract';
import { WAKE_DIRECTORY_PREFIX } from '../../src/connector-support/wake-directory';

const BINARY_NAME = 'fixture-binary';
const HOME_FOLDER = '.fixture-home';
const HOME_VARIABLE = 'FIXTURE_HOME';
const SESSIONS_FOLDER = 'sessions';
const STRICT_MCP_ARGUMENT = '--strict-config';
const MCP_CONFIG_ARGUMENT = '--mcp-config=';
const MCP_CONFIG_FILE_NAME = 'mcp.json';
const MCP_SERVER_TYPE = 'http';
const OWNER_ONLY_FILE_MODE = 0o600;
const RESUME_ARGUMENT = 'resume';
const REFUSAL_MESSAGE = 'thread already has an active writer';

async function findNewestSessionId(input: SessionLookupInput): Promise<string | null> {
  const folder = join(input.homeDirectory, SESSIONS_FOLDER);
  const names = await readdir(folder).catch(() => [] as string[]);
  const sessions = await Promise.all(
    names.filter((name) => UUID_PATTERN.test(name)).map(async (name) => ({ name, modifiedAtMs: (await stat(join(folder, name))).mtimeMs })),
  );
  const [newest] = sessions.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);
  if (newest === undefined) return null;
  return newest.name;
}

async function prepareIsolation(input: WakeIsolationInput): Promise<WakeIsolation> {
  const directory = await mkdtemp(join(tmpdir(), WAKE_DIRECTORY_PREFIX));
  const configFile = join(directory, MCP_CONFIG_FILE_NAME);
  const configuration = { mcpServers: { [ZAPBIP_SERVER_NAME]: { type: MCP_SERVER_TYPE, url: input.connectionLink } } };
  await writeFile(configFile, JSON.stringify(configuration), { mode: OWNER_ONLY_FILE_MODE });
  return {
    isolationArguments: [STRICT_MCP_ARGUMENT, `${MCP_CONFIG_ARGUMENT}${configFile}`],
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
  resumeArguments: ({ sessionId, isolationArguments }) => [RESUME_ARGUMENT, sessionId, ...isolationArguments],
  newSessionArguments: ({ isolationArguments }) => isolationArguments,
  prepareIsolation,
  isNewSessionFallback: ({ stderrText }) => stderrText.includes(REFUSAL_MESSAGE),
};
