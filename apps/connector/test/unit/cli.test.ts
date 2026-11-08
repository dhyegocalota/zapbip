import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectorClient } from '@zapbip/agents/connector';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseConnectArguments } from '../../src/cli';
import { CONNECTOR_CLIENTS, SUBJECT_CLIENT } from '../support/connector-clients';

const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const CLIENT_FLAG = '--client';
const SESSION_FLAG = '--session';
const WORKING_DIRECTORY_FLAG = '--cwd';
const UNDECLARED_CLIENT = 'nope';
const USAGE_LINE = `usage: zapbip connect --client ${CONNECTOR_CLIENTS.join('|')} [--cwd <directory>] [--session <uuid>]`;

function thrownMessage(input: { argv: string[] }): string {
  try {
    parseConnectArguments({ argv: input.argv });
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('parseConnectArguments did not throw');
}

describe('parseConnectArguments', () => {
  let scratchDirectory: string;

  beforeEach(async () => {
    scratchDirectory = await mkdtemp(join(tmpdir(), 'zapbip-cli-'));
  });

  afterEach(async () => {
    await rm(scratchDirectory, { recursive: true, force: true });
  });

  it('accepts the client alone and defaults to the current directory with no pinned session', () => {
    expect(parseConnectArguments({ argv: [CLIENT_FLAG, SUBJECT_CLIENT] })).toEqual({
      client: SUBJECT_CLIENT,
      workingDirectory: process.cwd(),
      pinnedSessionId: null,
    });
  });

  it('pins the session when it is a uuid', () => {
    const parsed = parseConnectArguments({ argv: [CLIENT_FLAG, SUBJECT_CLIENT, SESSION_FLAG, SESSION_ID] });
    expect(parsed.pinnedSessionId).toBe(SESSION_ID);
  });

  it('takes the working directory from the flag', () => {
    const parsed = parseConnectArguments({ argv: [CLIENT_FLAG, SUBJECT_CLIENT, WORKING_DIRECTORY_FLAG, scratchDirectory] });
    expect(parsed.workingDirectory).toBe(scratchDirectory);
  });

  it('refuses an unknown client and lists the valid ones', () => {
    const message = thrownMessage({ argv: [CLIENT_FLAG, UNDECLARED_CLIENT] });
    CONNECTOR_CLIENTS.forEach((client) => expect(message).toContain(client));
  });

  it('refuses a missing client with the usage line', () => {
    expect(thrownMessage({ argv: [] })).toBe(USAGE_LINE);
  });

  it('refuses a client no runtime declares with the usage line and no default', () => {
    expect(thrownMessage({ argv: [CLIENT_FLAG, UNDECLARED_CLIENT] })).toBe(USAGE_LINE);
  });

  it.each(CONNECTOR_CLIENTS)('accepts the %s runtime', (client) => {
    expect(parseConnectArguments({ argv: [CLIENT_FLAG, client] }).client).toBe(client);
  });

  it('refuses a session that is not a uuid without echoing it', () => {
    const badValue = 'not-a-uuid';
    const message = thrownMessage({ argv: [CLIENT_FLAG, SUBJECT_CLIENT, SESSION_FLAG, badValue] });
    expect(message).not.toContain(badValue);
  });

  it('refuses a working directory that does not exist', () => {
    const missingDirectory = join(scratchDirectory, 'missing');
    expect(() => parseConnectArguments({ argv: [CLIENT_FLAG, SUBJECT_CLIENT, WORKING_DIRECTORY_FLAG, missingDirectory] })).toThrow();
  });

  it('refuses a working directory that is a regular file', async () => {
    const regularFile = join(scratchDirectory, 'file.txt');
    await writeFile(regularFile, 'x');
    expect(() => parseConnectArguments({ argv: [CLIENT_FLAG, SUBJECT_CLIENT, WORKING_DIRECTORY_FLAG, regularFile] })).toThrow();
  });

  it('refuses a flag without a value', () => {
    expect(() => parseConnectArguments({ argv: [CLIENT_FLAG] })).toThrow();
  });
});
