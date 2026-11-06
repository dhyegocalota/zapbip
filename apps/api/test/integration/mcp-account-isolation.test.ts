import { env } from 'cloudflare:workers';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import { applyDirectoryMigration } from '../support/seed';
import { accountInbox, callTool, connectClient, seedConnectionWithSecret } from './mcp-fixtures';

const OWN_ACCOUNT_ID = 'acc_iso_1';
const OTHER_ACCOUNT_ID = 'acc_iso_2';

describe('account isolation over MCP', () => {
  beforeEach(applyDirectoryMigration);
  afterEach(reset);

  it('[row 445] ignores an accountId query parameter of another account', async () => {
    const own = await seedConnectionWithSecret({ accountId: OWN_ACCOUNT_ID, agent: 'alpha' });
    await seedConnectionWithSecret({ accountId: OTHER_ACCOUNT_ID, agent: 'beta' });
    const client = await connectClient({ secret: own.secret, search: `?accountId=${OTHER_ACCOUNT_ID}` });
    const sent = await callTool({ client, name: McpToolName.SendMessage, arguments: { text: 'oi' } });
    expect(sent.isError).not.toBe(true);
    expect(await accountInbox({ accountId: OWN_ACCOUNT_ID }).readScreen()).toHaveLength(1);
    expect(await accountInbox({ accountId: OTHER_ACCOUNT_ID }).readScreen()).toHaveLength(0);
  });

  it('[row 446] gives each account its own Durable Object and never reads the storage of another', async () => {
    const own = await seedConnectionWithSecret({ accountId: OWN_ACCOUNT_ID, agent: 'alpha' });
    const client = await connectClient({ secret: own.secret });
    await callTool({ client, name: McpToolName.SendMessage, arguments: { text: 'oi' } });
    const ownId = env.ACCOUNT_INBOX.idFromName(OWN_ACCOUNT_ID);
    const otherId = env.ACCOUNT_INBOX.idFromName(OTHER_ACCOUNT_ID);
    expect(ownId.toString()).not.toBe(otherId.toString());
    expect(await accountInbox({ accountId: OWN_ACCOUNT_ID }).readScreen()).toHaveLength(1);
    expect(await accountInbox({ accountId: OTHER_ACCOUNT_ID }).readScreen()).toHaveLength(0);
  });
});
