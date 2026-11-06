import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyDirectoryMigration } from '../support/seed';
import { failNextSessionSend } from '../support/session-send-probe';
import { postMcp } from './mcp-fixtures';
import { bindingsWith, deliver, findAccounts, latestMcpPath, WA_ID } from './owner-inbound-fixtures';

const AGENT_NAME = 'claude';
const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;

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

  it('AK-2 stops the old secret at once and opens the new one through MCP', async () => {
    const oldPath = await latestMcpPath({ accountId: await accountId() });
    expect((await postMcp({ path: oldPath })).status).toBe(STATUS_OK);
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    const newPath = await latestMcpPath({ accountId: await accountId() });
    expect(newPath).not.toBe(oldPath);
    expect((await postMcp({ path: oldPath })).status).toBe(STATUS_UNAUTHORIZED);
    expect((await postMcp({ path: newPath })).status).toBe(STATUS_OK);
  });

  it('AK-3 keeps the old secret working when the rotate reply fails to send', async () => {
    const id = await accountId();
    const oldPath = await latestMcpPath({ accountId: id });
    await failNextSessionSend({ accountId: id });
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    expect((await postMcp({ path: oldPath })).status).toBe(STATUS_OK);
  });
});
