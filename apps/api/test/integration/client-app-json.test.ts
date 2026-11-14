import { reset, runInDurableObject } from 'cloudflare:test';
import { AccountPlan, AccountState, HttpStatus, PRICING_FREE_MESSAGES, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { accountOverviewWireSchema } from '../../src/contract/mcp-schemas';
import { clientAppFetch, OTHER_ACCOUNT, prepareClientAppDatabase, seedAccountForApp, signIn } from '../support/client-app';
import { seedConnection, SEED_CREATED_AT } from '../support/seed';
import { seedStartNumber } from '../support/start-link-numbers';
import { accountInboxStub } from '../support/workers-env';

const JSON_ACCEPT = { Accept: 'application/json' };
const JSON_CONTENT_TYPE = 'application/json';
const MASKED_PHONE = '••••-0051';
const SEEN_AT = 1_700_000_500_000;
const SIGN_IN_REQUIRED = { error: 'sign_in_required' };

beforeEach(async () => {
  await prepareClientAppDatabase();
  await seedStartNumber({ numberId: 'num_app_json', displayNumber: '+5511977770004', state: WhatsAppNumberState.Active, createdAt: 1 });
});
afterEach(reset);

describe('the client app JSON twin of the home page', () => {
  it('answers Accept application/json with the account overview the page shows', async () => {
    const { cookie, accountId } = await signIn({});
    await seedConnection({ accountId, agent: 'alpha', secret: generateConnectionSecret() });
    await runInDurableObject(accountInboxStub({ accountId }), (_instance, state) => {
      state.storage.sql.exec('INSERT INTO agents (agent, last_seen_at) VALUES (?, ?)', 'alpha', SEEN_AT);
    });
    const response = await clientAppFetch({ path: '/', cookie, headers: JSON_ACCEPT });
    const overview = accountOverviewWireSchema.parse(await response.json());
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get('Content-Type')).toContain(JSON_CONTENT_TYPE);
    expect(response.headers.get('Vary')).toContain('Accept');
    expect(overview).toEqual({
      state: AccountState.Active,
      phone: MASKED_PHONE,
      plan: AccountPlan.Free,
      free_messages: PRICING_FREE_MESSAGES,
      agents: [
        {
          name: 'alpha',
          client: null,
          created_at: new Date(SEED_CREATED_AT).toISOString(),
          last_active_at: new Date(SEEN_AT).toISOString(),
        },
      ],
    });
  });

  it('serves the same overview on the Portuguese path', async () => {
    const { cookie } = await signIn({});
    const response = await clientAppFetch({ path: '/pt-br', cookie, headers: JSON_ACCEPT });
    expect(accountOverviewWireSchema.parse(await response.json()).state).toBe(AccountState.Active);
  });

  it('never lists the agents of another account', async () => {
    const { cookie } = await signIn({});
    const otherAccountId = await seedAccountForApp({ accountId: OTHER_ACCOUNT, phone: '5511900000099' });
    await seedConnection({ accountId: otherAccountId, agent: 'stranger', secret: generateConnectionSecret() });
    const response = await clientAppFetch({ path: '/', cookie, headers: JSON_ACCEPT });
    expect(accountOverviewWireSchema.parse(await response.json()).agents).toEqual([]);
  });

  it('shows a waitlisted account with no agents', async () => {
    const { cookie } = await signIn({ state: AccountState.Waitlisted });
    const response = await clientAppFetch({ path: '/', cookie, headers: JSON_ACCEPT });
    expect(accountOverviewWireSchema.parse(await response.json())).toMatchObject({ state: AccountState.Waitlisted, agents: [] });
  });

  it('answers a signed-out caller with 401 and no account data', async () => {
    const response = await clientAppFetch({ path: '/', headers: JSON_ACCEPT });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await response.json()).toEqual(SIGN_IN_REQUIRED);
  });

  it('keeps answering HTML to a browser and tells caches the answer depends on Accept', async () => {
    const { cookie } = await signIn({});
    const response = await clientAppFetch({ path: '/', cookie, headers: { Accept: 'text/html' } });
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('Vary')).toContain('Accept');
    expect(await response.text()).toContain('Your agents');
  });
});
