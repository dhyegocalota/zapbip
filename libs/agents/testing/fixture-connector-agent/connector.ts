import { readdir } from 'node:fs/promises';
import type { AgentConnectorRuntime, SessionLookupInput } from '../../src/contract';

const BINARY_NAME = 'fixture-binary';
const SESSION_FOLDER = '.fixture-sessions';
const REFUSAL_MESSAGE = 'fixture session is busy';

async function findNewestSessionId(input: SessionLookupInput): Promise<string | null> {
  const sessionIds = await readdir(`${input.workingDirectory}/${SESSION_FOLDER}`).catch(() => [] as string[]);
  const newestSessionId = sessionIds.sort().at(-1);
  if (newestSessionId === undefined) return null;
  return newestSessionId;
}

export const runtime: AgentConnectorRuntime = {
  binaryName: BINARY_NAME,
  findNewestSessionId,
  resumeArguments: ({ sessionId, isolationArguments }) => ['--resume', sessionId, ...isolationArguments],
  newSessionArguments: ({ isolationArguments }) => ['--new', ...isolationArguments],
  prepareIsolation: async () => ({ isolationArguments: ['--isolated'], cleanup: async () => undefined }),
  isNewSessionFallback: ({ stderrText }) => stderrText.includes(REFUSAL_MESSAGE),
};
