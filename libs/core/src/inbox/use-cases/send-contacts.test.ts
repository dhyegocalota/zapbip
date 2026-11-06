import { DeliveryState, InboxErrorCode, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { ContactCard } from '../message';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment } from '../testing/fixtures';
import { sendContacts } from './send-contacts';

const alpha = connectionOf({ agent: 'alpha' });

function cards(count: number): ContactCard[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Maria ${index}`,
    phones: ['+5511999990000'],
    emails: [],
    organization: null,
  }));
}

async function send(input: { count: number }) {
  const environment = await createEnvironment();
  const outcome = await sendContacts({
    dependencies: environment.dependencies,
    connection: alpha,
    contacts: cards(input.count),
    replyToMessageId: null,
  });
  return { environment, outcome };
}

describe('sendContacts', () => {
  test('sends ten cards', async () => {
    const { environment, outcome } = await send({ count: 10 });
    expect(outcome.delivery).toBe(DeliveryState.Sent);
    expect(environment.sender.sessions[0]).toMatchObject({ kind: MessageKind.Contacts, contacts: cards(10) });
  });

  test('CU-155 eleven cards', async () => {
    const error = await captureInboxError(() => send({ count: 11 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'contacts: must have 1 to 10 entries' });
  });

  test('no cards', async () => {
    const error = await captureInboxError(() => send({ count: 0 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'contacts: must have 1 to 10 entries' });
  });
});
