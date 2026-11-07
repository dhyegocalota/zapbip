import { describe, expect, it } from 'vitest';
import { answerWebhookChallenge } from '../../src/adapters/whatsapp/challenge';
import { WebhookHubMode } from '../../src/adapters/whatsapp/whatsapp-enums';

const EXPECTED_TOKEN = 'test-verify-token';
const CHALLENGE = '123456';
const STATUS_OK = 200;
const STATUS_FORBIDDEN = 403;

describe('answerWebhookChallenge', () => {
  it('AU-7 echoes the challenge when mode and token match', async () => {
    const answer = await answerWebhookChallenge({
      mode: WebhookHubMode.Subscribe,
      token: EXPECTED_TOKEN,
      challenge: CHALLENGE,
      expectedToken: EXPECTED_TOKEN,
    });
    expect(answer).toEqual({ status: STATUS_OK, body: CHALLENGE });
  });

  it('AU-8 refuses a wrong token', async () => {
    const answer = await answerWebhookChallenge({
      mode: WebhookHubMode.Subscribe,
      token: 'wrong',
      challenge: CHALLENGE,
      expectedToken: EXPECTED_TOKEN,
    });
    expect(answer).toEqual({ status: STATUS_FORBIDDEN, body: null });
  });

  it('AU-9 refuses a mode other than subscribe', async () => {
    const answer = await answerWebhookChallenge({
      mode: 'unsubscribe',
      token: EXPECTED_TOKEN,
      challenge: CHALLENGE,
      expectedToken: EXPECTED_TOKEN,
    });
    expect(answer).toEqual({ status: STATUS_FORBIDDEN, body: null });
  });

  it('AU-10 refuses a missing challenge', async () => {
    const answer = await answerWebhookChallenge({
      mode: WebhookHubMode.Subscribe,
      token: EXPECTED_TOKEN,
      challenge: null,
      expectedToken: EXPECTED_TOKEN,
    });
    expect(answer).toEqual({ status: STATUS_FORBIDDEN, body: null });
  });

  it('refuses a missing token and a missing mode', async () => {
    const withoutToken = await answerWebhookChallenge({
      mode: WebhookHubMode.Subscribe,
      token: null,
      challenge: CHALLENGE,
      expectedToken: EXPECTED_TOKEN,
    });
    const withoutMode = await answerWebhookChallenge({
      mode: null,
      token: EXPECTED_TOKEN,
      challenge: CHALLENGE,
      expectedToken: EXPECTED_TOKEN,
    });
    expect(withoutToken).toEqual({ status: STATUS_FORBIDDEN, body: null });
    expect(withoutMode).toEqual({ status: STATUS_FORBIDDEN, body: null });
  });
});
