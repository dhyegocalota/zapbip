import { HttpStatus } from '@zapbip/types';
import { timingSafeEqual } from 'node:crypto';
import { WebhookHubMode } from './whatsapp-enums';

type ChallengeAnswer = { status: number; body: string | null };

const REFUSED: ChallengeAnswer = { status: HttpStatus.Forbidden, body: null };

async function digestOf(input: { value: string }): Promise<Buffer> {
  return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.value)));
}

export async function answerWebhookChallenge(input: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expectedToken: string;
}): Promise<ChallengeAnswer> {
  const { token, challenge } = input;
  const isSubscribe = input.mode === WebhookHubMode.Subscribe;
  if (!isSubscribe || token === null || challenge === null) return REFUSED;
  const [tokenDigest, expectedDigest] = await Promise.all([digestOf({ value: token }), digestOf({ value: input.expectedToken })]);
  if (!timingSafeEqual(tokenDigest, expectedDigest)) return REFUSED;
  return { status: HttpStatus.Ok, body: challenge };
}
