import { randomInt } from 'node:crypto';
import { MessageKind } from '@zapbip/types';
import { ClientAppVariable, clientAppValue } from './client-app-environment';

const LINK_PATTERN = /https?:\/\/[^\s]+\/sign-in\/[A-Za-z0-9_-]{43}/;
const BRAZIL_PREFIX = '55119';
const UNITED_STATES_PREFIX = '1415';
const SUFFIX_LIMIT = 10_000_000;
const SUFFIX_DIGITS = 7;

export type OwnerPhoneKind = 'brazil' | 'united_states';

const PREFIXES: Record<OwnerPhoneKind, string> = { brazil: BRAZIL_PREFIX, united_states: UNITED_STATES_PREFIX };

export function newOwnerPhone(input: { kind: OwnerPhoneKind }): string {
  return `${PREFIXES[input.kind]}${String(randomInt(SUFFIX_LIMIT)).padStart(SUFFIX_DIGITS, '0')}`;
}

async function sendText(input: { phone: string; text: string }): Promise<void> {
  const origin = clientAppValue({ variable: ClientAppVariable.PublicOrigin });
  const response = await fetch(`${origin}/dev/owner/${input.phone}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
  if (!response.ok) throw new Error(`the owner simulator answered ${response.status}`);
}

async function screenTexts(input: { phone: string }): Promise<string[]> {
  const origin = clientAppValue({ variable: ClientAppVariable.PublicOrigin });
  const response = await fetch(`${origin}/dev/owner/${input.phone}/screen`);
  const body = (await response.json()) as { entries: { text: string }[] };
  return body.entries.map((entry) => entry.text);
}

export async function requestSignInLink(input: { phone: string; word: string }): Promise<string> {
  await sendText({ phone: input.phone, text: input.word });
  const texts = await screenTexts({ phone: input.phone });
  const link = texts
    .map((text) => LINK_PATTERN.exec(text))
    .filter((match) => match !== null)
    .at(-1);
  if (link === undefined) throw new Error('the owner simulator screen has no sign-in link');
  return link[0];
}
