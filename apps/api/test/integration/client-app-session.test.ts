import { reset, runInDurableObject } from 'cloudflare:test';
import { AccountState, HttpStatus, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEE_OTHER_STATUS } from '../../src/backoffice/backoffice-constants';
import { D1AccountDirectory } from '../../src/adapters/d1/d1-account-directory';
import { D1ConnectionRegistry } from '../../src/adapters/d1/d1-connection-registry';
import { createSession } from '../../src/client-app/sessions';
import { csrfTokenOf } from '../../src/client-app/csrf';
import {
  clientAppFetch,
  issueSignInToken,
  OTHER_ACCOUNT,
  OTHER_PHONE,
  OWNER_PHONE,
  prepareClientAppDatabase,
  seedAccountForApp,
  signIn,
  signInAgain,
} from '../support/client-app';
import { seedStartNumber } from '../support/start-link-numbers';
import { accountInboxStub, testEnv } from '../support/workers-env';

const SEEN_AT = 1_700_000_000_000;
const SIGN_IN_BUTTON_COPY = 'Sign in with WhatsApp';
const NAME_FIELD = 'agentName';
const AGENT_FIELD = 'agent';
const CONFIRM_FIELD = 'confirm';
const CONFIRM_VALUE = 'yes';
const COUNT_SESSIONS_STATEMENT = 'SELECT COUNT(*) AS total FROM client_app_sessions';

function activeAgents(input: { accountId: string }): Promise<string[]> {
  return new D1ConnectionRegistry({ database: testEnv.CONNECTIONS })
    .listActive({ accountId: input.accountId })
    .then((connections) => connections.map((connection) => connection.agent));
}

async function connect(input: { cookie: string; csrf: string; name: string }): Promise<Response> {
  return clientAppFetch({ path: '/agents', method: 'POST', cookie: input.cookie, form: { csrf: input.csrf, [NAME_FIELD]: input.name } });
}

beforeEach(async () => {
  await prepareClientAppDatabase();
  await seedStartNumber({ numberId: 'num_app_session', displayNumber: '+5511977770003', state: WhatsAppNumberState.Active, createdAt: 1 });
});
afterEach(reset);

describe('the signed-out page', () => {
  it('treats an unknown session cookie as signed out and offers the WhatsApp button', async () => {
    const html = await (await clientAppFetch({ path: '/', cookie: 'unknown'.repeat(8) })).text();
    expect(html).toContain(SIGN_IN_BUTTON_COPY);
    expect(html).not.toContain('Your agents');
  });
});

describe('a waitlisted account', () => {
  it('sees the waitlist state, a sign-out button and no agent controls', async () => {
    const { cookie } = await signIn({ state: AccountState.Waitlisted });
    const html = await (await clientAppFetch({ path: '/', cookie })).text();
    expect(html).toContain('on the waitlist');
    expect(html).toContain('action="/sign-out"');
    expect(html).not.toContain('action="/agents"');
  });

  it('cannot connect an agent', async () => {
    const { cookie, csrf, accountId } = await signIn({ state: AccountState.Waitlisted });
    const response = await connect({ cookie, csrf, name: 'alpha' });
    expect(response.status).toBe(HttpStatus.Forbidden);
    expect(await activeAgents({ accountId })).toEqual([]);
  });
});

describe('an active account', () => {
  it('lists its agents, the plan line and the delete-account docs link', async () => {
    const { cookie, csrf } = await signIn({});
    await connect({ cookie, csrf, name: 'alpha' });
    const html = await (await clientAppFetch({ path: '/', cookie })).text();
    expect(html).toContain('Your agents');
    expect(html).toContain('alpha');
    expect(html).toContain('Free · early access');
    expect(html).toContain('help/delete-your-account');
  });

  it('connects an agent through the command use case and shows the install prompt once', async () => {
    const { cookie, csrf, accountId } = await signIn({});
    const created = await connect({ cookie, csrf, name: 'Test Agent' });
    const createdHtml = await created.text();
    expect(created.status).toBe(HttpStatus.Ok);
    expect(createdHtml).toContain('/i/zb_inst_');
    expect(createdHtml).not.toContain('zb_conn_');
    expect(await activeAgents({ accountId })).toEqual(['test-agent']);
    const reloaded = await (await clientAppFetch({ path: '/', cookie })).text();
    expect(reloaded).not.toContain('/i/zb_inst_');
    expect(reloaded).toContain('test-agent');
  });

  it.each([
    ['', 'Enter a name'],
    ['login', 'reserved'],
    ['!!!', 'Invalid name'],
  ])('refuses the name %j with a reason and creates nothing', async (name, reason) => {
    const { cookie, csrf, accountId } = await signIn({});
    const response = await connect({ cookie, csrf, name });
    expect(await response.text()).toContain(reason);
    expect(await activeAgents({ accountId })).toEqual([]);
  });

  it('refuses a name already in use', async () => {
    const { cookie, csrf } = await signIn({});
    await connect({ cookie, csrf, name: 'alpha' });
    expect(await (await connect({ cookie, csrf, name: 'alpha' })).text()).toContain('already exists');
  });

  it('asks for a confirmation before revoking, then revokes and shows the notice', async () => {
    const { cookie, csrf, accountId } = await signIn({});
    await connect({ cookie, csrf, name: 'alpha' });
    const asked = await clientAppFetch({ path: '/agents/revoke', method: 'POST', cookie, form: { csrf, [AGENT_FIELD]: 'alpha' } });
    expect(await asked.text()).toContain('Revoke alpha?');
    expect(await activeAgents({ accountId })).toEqual(['alpha']);
    const confirmed = await clientAppFetch({
      path: '/agents/revoke',
      method: 'POST',
      cookie,
      form: { csrf, [AGENT_FIELD]: 'alpha', [CONFIRM_FIELD]: CONFIRM_VALUE },
    });
    expect(confirmed.status).toBe(SEE_OTHER_STATUS);
    expect(await activeAgents({ accountId })).toEqual([]);
    const home = await (await clientAppFetch({ path: confirmed.headers.get('Location')!, cookie })).text();
    expect(home).toContain('Agent revoked.');
  });

  it('refuses a form without the session CSRF token', async () => {
    const { cookie, accountId } = await signIn({});
    const response = await connect({ cookie, csrf: 'wrong', name: 'alpha' });
    expect(response.status).toBe(HttpStatus.Forbidden);
    expect(await activeAgents({ accountId })).toEqual([]);
  });

  it('refuses a form from a foreign origin', async () => {
    const { cookie, csrf } = await signIn({});
    const response = await clientAppFetch({
      path: '/agents',
      method: 'POST',
      cookie,
      form: { csrf, [NAME_FIELD]: 'alpha' },
      origin: 'https://evil.example',
    });
    expect(response.status).toBe(HttpStatus.Forbidden);
  });

  it('renders in Portuguese under the pt-br path', async () => {
    const { cookie } = await signIn({ locale: OwnerLocale.PortugueseBrazil });
    const html = await (await clientAppFetch({ path: '/pt-br', cookie })).text();
    expect(html).toContain('Seus agentes');
    expect(html).toContain('Grátis · acesso antecipado');
  });
});

describe('account isolation', () => {
  it('never lists nor revokes the agent of another account', async () => {
    const mine = await signIn({});
    const theirs = await signIn({ accountId: OTHER_ACCOUNT, phone: OTHER_PHONE });
    await connect({ cookie: theirs.cookie, csrf: theirs.csrf, name: 'secret-agent' });
    const html = await (await clientAppFetch({ path: '/', cookie: mine.cookie })).text();
    expect(html).not.toContain('secret-agent');
    await clientAppFetch({
      path: '/agents/revoke',
      method: 'POST',
      cookie: mine.cookie,
      form: { csrf: mine.csrf, [AGENT_FIELD]: 'secret-agent', [CONFIRM_FIELD]: CONFIRM_VALUE },
    });
    expect(await activeAgents({ accountId: OTHER_ACCOUNT })).toEqual(['secret-agent']);
  });

  it('refuses the CSRF token of another session', async () => {
    const mine = await signIn({});
    const theirs = await signIn({ accountId: OTHER_ACCOUNT, phone: OTHER_PHONE });
    const response = await connect({ cookie: mine.cookie, csrf: theirs.csrf, name: 'alpha' });
    expect(response.status).toBe(HttpStatus.Forbidden);
  });
});

describe('session revocation', () => {
  it('sign-out ends every session of the account', async () => {
    const first = await signIn({});
    const secondCookie = (await createSession({ database: testEnv.CONNECTIONS, accountId: first.accountId, now: Date.now() }))!;
    const secondCsrf = await csrfTokenOf({ secret: secondCookie });
    await clientAppFetch({ path: '/sign-out', method: 'POST', cookie: secondCookie, form: { csrf: secondCsrf } });
    expect(await (await clientAppFetch({ path: '/', cookie: first.cookie })).text()).toContain(SIGN_IN_BUTTON_COPY);
  });

  it('a new sign-in ends the earlier sessions of the account and keeps one row', async () => {
    const first = await signIn({});
    const second = await signInAgain({ accountId: first.accountId });
    expect(await (await clientAppFetch({ path: '/', cookie: first.cookie })).text()).toContain(SIGN_IN_BUTTON_COPY);
    expect(await (await clientAppFetch({ path: '/', cookie: second.cookie })).text()).toContain('Your agents');
    expect((await testEnv.CONNECTIONS.prepare(COUNT_SESSIONS_STATEMENT).first<{ total: number }>())!.total).toBe(1);
  });

  it('a new sign-in with the cookie of a live session replaces that session', async () => {
    const first = await signIn({});
    const second = await signInAgain({ accountId: first.accountId, cookie: first.cookie });
    expect(second.cookie).not.toBe(first.cookie);
    expect((await testEnv.CONNECTIONS.prepare(COUNT_SESSIONS_STATEMENT).first<{ total: number }>())!.total).toBe(1);
  });

  it('a link of a suspended account answers 410 and leaves no session row', async () => {
    const accountId = await seedAccountForApp({ state: AccountState.Suspended });
    const token = await issueSignInToken({ accountId });
    const response = await clientAppFetch({
      path: `/sign-in/${token}`,
      method: 'POST',
      form: { csrf: await csrfTokenOf({ secret: token }) },
    });
    expect(response.status).toBe(HttpStatus.Gone);
    expect((await testEnv.CONNECTIONS.prepare(COUNT_SESSIONS_STATEMENT).first<{ total: number }>())!.total).toBe(0);
  });
});

describe('what the home page shows about the owner and the agents', () => {
  it('shows the masked phone on the Continue page and on the home page', async () => {
    await seedAccountForApp({});
    const token = await issueSignInToken({});
    expect(await (await clientAppFetch({ path: `/sign-in/${token}` })).text()).toContain('+55 ••••-0051');
    const { cookie } = await signIn({});
    const html = await (await clientAppFetch({ path: '/', cookie })).text();
    expect(html).toContain('+55 ••••-0051');
    expect(html).not.toContain(OWNER_PHONE);
  });

  it('shows the last active day of an agent the object has seen and nothing for one it has not', async () => {
    const { cookie, csrf, accountId } = await signIn({});
    await connect({ cookie, csrf, name: 'seen' });
    await connect({ cookie, csrf, name: 'quiet' });
    await runInDurableObject(accountInboxStub({ accountId }), (_instance, state) => {
      state.storage.sql.exec(
        'INSERT INTO agents (agent, last_seen_at) VALUES (?, ?) ON CONFLICT (agent) DO UPDATE SET last_seen_at = excluded.last_seen_at',
        'seen',
        SEEN_AT,
      );
    });
    const html = await (await clientAppFetch({ path: '/', cookie })).text();
    expect(html).toContain('Last active 2023-11-14');
    expect(html.match(/Last active/g)).toHaveLength(1);
  });

  it('drops the client segment while the client is unknown', async () => {
    const { cookie, csrf } = await signIn({});
    await connect({ cookie, csrf, name: 'alpha' });
    expect(await (await clientAppFetch({ path: '/', cookie })).text()).not.toContain('Client:');
  });
});

describe('session lifetime', () => {
  it('signs out: the row is deleted and the cookie no longer opens the app', async () => {
    const { cookie, csrf } = await signIn({});
    const response = await clientAppFetch({ path: '/sign-out', method: 'POST', cookie, form: { csrf } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect((await testEnv.CONNECTIONS.prepare(COUNT_SESSIONS_STATEMENT).first<{ total: number }>())!.total).toBe(0);
    expect(await (await clientAppFetch({ path: '/', cookie })).text()).toContain(SIGN_IN_BUTTON_COPY);
  });

  it('ends when the account is deleted', async () => {
    const { cookie, accountId } = await signIn({});
    await new D1AccountDirectory({ database: testEnv.CONNECTIONS }).remove({ accountId });
    expect(await (await clientAppFetch({ path: '/', cookie })).text()).toContain(SIGN_IN_BUTTON_COPY);
    expect((await testEnv.CONNECTIONS.prepare(COUNT_SESSIONS_STATEMENT).first<{ total: number }>())!.total).toBe(0);
  });

  it.each([AccountState.Suspended, AccountState.Deleting])('ends when the account becomes %s', async (state) => {
    const { cookie, accountId } = await signIn({});
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(state, accountId).run();
    expect(await (await clientAppFetch({ path: '/', cookie })).text()).toContain(SIGN_IN_BUTTON_COPY);
  });

  it('ends after thirty days', async () => {
    const { cookie } = await signIn({});
    await testEnv.CONNECTIONS.prepare('UPDATE client_app_sessions SET expires_at = ?')
      .bind(Date.now() - 1)
      .run();
    expect(await (await clientAppFetch({ path: '/', cookie })).text()).toContain(SIGN_IN_BUTTON_COPY);
  });
});
