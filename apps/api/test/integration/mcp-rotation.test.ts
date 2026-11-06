import { InstallCodeStatus } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyDirectoryMigration } from '../support/seed';
import { installCodeDirectory } from '../support/install-codes';
import { failNextSessionSend } from '../support/session-send-probe';
import { postMcp } from './mcp-fixtures';
import { bindingsWith, deliver, findAccounts, screenTextsOf, WA_ID } from './owner-inbound-fixtures';

const AGENT_NAME = 'claude';
const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const INSTALL_CODE_PATTERN = /\/i\/(zb_inst_[A-Za-z0-9_-]{22})/g;
const SECRET_IN_LINK_PATTERN = /\/c\/([^/]+)\/mcp/;

async function latestSecret(input: { accountId: string }): Promise<string> {
  const texts = await screenTextsOf({ accountId: input.accountId });
  const codes = [...texts.join('\n').matchAll(INSTALL_CODE_PATTERN)];
  const latest = codes.at(-1);
  if (latest === undefined) throw new Error('no install code on the screen');
  const resolution = await installCodeDirectory().resolve({ installCode: latest[1], now: Date.now() });
  if (resolution.status !== InstallCodeStatus.Ready) throw new Error('the install code is not ready');
  const secret = SECRET_IN_LINK_PATTERN.exec(resolution.connectionLink);
  if (secret === null) throw new Error('the link has no secret');
  return secret[1];
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

  it('AK-2 stops the old secret at once and opens the new one through MCP', async () => {
    const oldSecret = await latestSecret({ accountId: await accountId() });
    expect((await postMcp({ path: `/c/${oldSecret}/mcp` })).status).toBe(STATUS_OK);
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    const newSecret = await latestSecret({ accountId: await accountId() });
    expect(newSecret).not.toBe(oldSecret);
    expect((await postMcp({ path: `/c/${oldSecret}/mcp` })).status).toBe(STATUS_UNAUTHORIZED);
    expect((await postMcp({ path: `/c/${newSecret}/mcp` })).status).toBe(STATUS_OK);
  });

  it('AK-3 keeps the old secret working and refuses the new one when the rotate reply fails to send', async () => {
    const id = await accountId();
    const oldSecret = await latestSecret({ accountId: id });
    await failNextSessionSend({ accountId: id });
    await deliver({ bindings, text: `girar ${AGENT_NAME}` });
    expect((await postMcp({ path: `/c/${oldSecret}/mcp` })).status).toBe(STATUS_OK);
  });
});
