import { AccountReplyIntent, AccountReplyParameter, AccountState, OwnerLocale, SIGN_IN_LINK_TTL_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { APP_ORIGIN, createAccountFixture, intentsOf, ownerInputOf, receiveAccountText, sessionTexts } from '../testing/fixtures';
import { issueSignInLink } from './issue-sign-in-link';

describe('issueSignInLink', () => {
  test('replies with a link on the app origin that carries the issued token', async () => {
    const fixture = await createAccountFixture({ locale: OwnerLocale.EnglishUs });
    const result = await issueSignInLink(ownerInputOf(fixture));
    const [issued] = fixture.environment.signInLinks.issued;
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.SignInLink]);
    expect(result.replies[0]!.parameters[AccountReplyParameter.SignInLink]).toBe(`${APP_ORIGIN}/sign-in/${issued!.token}`);
  });

  test('the token expires after the sign-in lifetime', async () => {
    const fixture = await createAccountFixture();
    await issueSignInLink(ownerInputOf(fixture));
    expect(fixture.environment.signInLinks.issued[0]!.expiresAt).toBe(fixture.environment.clock.now() + SIGN_IN_LINK_TTL_MS);
  });

  test('a Portuguese owner gets the pt-br link', async () => {
    const fixture = await createAccountFixture({ locale: OwnerLocale.PortugueseBrazil });
    const result = await issueSignInLink(ownerInputOf(fixture));
    expect(result.replies[0]!.parameters[AccountReplyParameter.SignInLink]).toContain(`${APP_ORIGIN}/pt-br/sign-in/`);
  });
});

describe.each([AccountState.Active, AccountState.Waitlisted])('login from a %s account', (state) => {
  test.each(['login', 'entrar'])('%s sends one message with the link', async (text) => {
    const fixture = await createAccountFixture({ state });
    await receiveAccountText({ ...fixture, text });
    const [message] = sessionTexts(fixture);
    expect(sessionTexts(fixture)).toHaveLength(1);
    expect(message).toContain(`${APP_ORIGIN}`);
    expect(message).toContain('/sign-in/');
  });
});

describe('the reply of a suspended account', () => {
  test('login sends the suspended notice and issues no token', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Suspended });
    await receiveAccountText({ ...fixture, text: 'login' });
    expect(fixture.environment.signInLinks.issued).toEqual([]);
  });
});
