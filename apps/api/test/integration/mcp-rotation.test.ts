import { InstallCodeStatus } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyDirectoryMigration } from '../support/seed';
import { installCodeDirectory } from '../support/install-codes';
import { failNextSessionSend } from '../support/session-send-probe';
import { McpToolName } from '../../src/contract/tool-definitions';
import { callTool, connectClient, postMcp } from './mcp-fixtures';
import { bindingsWith, deliver, findAccounts, screenTextsOf, WA_ID } from './owner-inbound-fixtures';

const AGENT_NAME = 'claude';
const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const SECRET_SEGMENT_INDEX = 2;
const INSTALL_CODE_PATTERN = /zb_inst_[A-Za-z0-9_-]{22}/g;

async function latestInstallCode(input: { accountId: string }): Promise<string> {
  const texts = await screenTextsOf({ accountId: input.accountId });
  const installCode = texts.join('\n').match(INSTALL_CODE_PATTERN)?.at(-1);
  if (installCode === undefined) throw new Error('no install code on the screen');
  return installCode;
}

async function latestMcpPath(input: { accountId: string }): Promise<string> {
  const installCode = await latestInstallCode(input);
  const resolution = await installCodeDirectory().resolve({ installCode, now: Date.now() });
  if (resolution.status !== InstallCodeStatus.Ready) throw new Error('the install code is not ready');
  return new URL(resolution.connectionLink).pathname;
}

async function accountId(): Promise<string> {
  const [account] = await findAccounts({ waId: WA_ID });
  if (account === undefined) throw new Error('account is missing');
  return account.accountId;
}

describe('rotating a connection over WhatsApp', () => {
  const bindings = bindingsWith({ waitlistEnabled: false });

  beforeEach(async () => {
    await applyDirectoryMigration();
    await deliver({ bindings, text: `novo agente ${AGENT_NAME}` });
  });
  afterEach(reset);

  it('[row 403][row 404] AK-2 stops the old secret at once and opens the new one through MCP', async () => {
    const oldPath = await latestMcpPath({ accountId: await accountId() });
    expect((await postMcp({ path: oldPath })).status).toBe(STATUS_OK);
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    const newPath = await latestMcpPath({ accountId: await accountId() });
    expect(newPath).not.toBe(oldPath);
    expect((await postMcp({ path: oldPath })).status).toBe(STATUS_UNAUTHORIZED);
    expect((await postMcp({ path: newPath })).status).toBe(STATUS_OK);
    const client = await connectClient({ secret: newPath.split('/')[SECRET_SEGMENT_INDEX] as string });
    const inbox = await callTool({ client, name: McpToolName.CheckInbox, arguments: {} });
    expect(inbox.isError).not.toBe(true);
  });

  it('AK-3 keeps the old secret working when the rotate reply fails to send', async () => {
    const id = await accountId();
    const oldPath = await latestMcpPath({ accountId: id });
    await failNextSessionSend({ accountId: id });
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    expect((await postMcp({ path: oldPath })).status).toBe(STATUS_OK);
  });

  it('[row 497][row 508][row 544] restores the old link and its install code when the second rotate reply fails to send', async () => {
    const id = await accountId();
    const firstPath = await latestMcpPath({ accountId: id });
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    const rotatedCode = await latestInstallCode({ accountId: id });
    const rotatedPath = await latestMcpPath({ accountId: id });
    expect((await postMcp({ path: firstPath })).status).toBe(STATUS_UNAUTHORIZED);
    await failNextSessionSend({ accountId: id });
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    expect((await postMcp({ path: rotatedPath })).status).toBe(STATUS_OK);
    const restored = await installCodeDirectory().resolve({ installCode: rotatedCode, now: Date.now() });
    expect(restored.status).toBe(InstallCodeStatus.Ready);
  });

  it('[row 500] answers the owner message that follows a rotate', async () => {
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    await deliver({ bindings, text: 'agentes' });
    const id = await accountId();
    expect((await screenTextsOf({ accountId: id })).at(-1)).toContain(AGENT_NAME);
  });
});
