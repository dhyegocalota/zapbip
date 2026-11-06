import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { ConnectorClient, SESSION_LOOKUP_LIMIT, UUID_PATTERN } from '@zapbip/types';

type LookupInput = { workingDirectory: string; claudeConfigDirectory: string; codexHome: string };
type SessionMeta = { sessionId: string; workingDirectory: string };
type SessionFile = { sessionId: string; modifiedAtMs: number };

const CLAUDE_PROJECTS_FOLDER = 'projects';
const CODEX_SESSIONS_FOLDER = 'sessions';
const CLAUDE_SESSION_EXTENSION = '.jsonl';
const CODEX_ROLLOUT_PATTERN = /(^|\/)rollout-[^/]+\.jsonl$/;
const SESSION_META_TYPE = 'session_meta';
const NON_ALPHANUMERIC_PATTERN = /[^A-Za-z0-9]/g;
const PROJECT_FOLDER_SEPARATOR = '-';
const MISSING_ENTRY_CODE = 'ENOENT';

const SESSION_FINDERS: Record<ConnectorClient, (input: LookupInput) => Promise<string | null>> = {
  [ConnectorClient.ClaudeCode]: findNewestClaudeSessionId,
  [ConnectorClient.Codex]: findNewestCodexSessionId,
};

export function claudeProjectFolderName(input: { workingDirectory: string }): string {
  return input.workingDirectory.replace(NON_ALPHANUMERIC_PATTERN, PROJECT_FOLDER_SEPARATOR);
}

export async function findNewestSessionId(input: {
  client: ConnectorClient;
  workingDirectory: string;
  claudeConfigDirectory?: string;
  codexHome?: string;
}): Promise<string | null> {
  const { client, workingDirectory, claudeConfigDirectory = join(homedir(), '.claude'), codexHome = join(homedir(), '.codex') } = input;
  return SESSION_FINDERS[client]({ workingDirectory, claudeConfigDirectory, codexHome });
}

async function listDirectory(input: { directory: string; recursive: boolean }): Promise<string[]> {
  try {
    return await readdir(input.directory, { recursive: input.recursive });
  } catch (error) {
    const isMissing = error instanceof Error && 'code' in error && error.code === MISSING_ENTRY_CODE;
    if (isMissing) return [];
    throw error;
  }
}

async function findNewestClaudeSessionId(input: LookupInput): Promise<string | null> {
  const folder = join(input.claudeConfigDirectory, CLAUDE_PROJECTS_FOLDER, claudeProjectFolderName(input));
  const fileNames = await listDirectory({ directory: folder, recursive: false });
  const candidateIds = fileNames
    .filter((fileName) => fileName.endsWith(CLAUDE_SESSION_EXTENSION))
    .map((fileName) => fileName.slice(0, -CLAUDE_SESSION_EXTENSION.length))
    .filter((sessionId) => UUID_PATTERN.test(sessionId));
  const sessionFiles: SessionFile[] = await Promise.all(
    candidateIds.map(async (sessionId) => ({
      sessionId,
      modifiedAtMs: (await stat(join(folder, `${sessionId}${CLAUDE_SESSION_EXTENSION}`))).mtimeMs,
    })),
  );
  const [newest] = sessionFiles.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);
  if (newest === undefined) return null;
  return newest.sessionId;
}

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

async function findNewestCodexSessionId(input: LookupInput): Promise<string | null> {
  const root = join(input.codexHome, CODEX_SESSIONS_FOLDER);
  const relativePaths = await listDirectory({ directory: root, recursive: true });
  const newestRollouts = relativePaths
    .filter((relativePath) => CODEX_ROLLOUT_PATTERN.test(relativePath))
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
