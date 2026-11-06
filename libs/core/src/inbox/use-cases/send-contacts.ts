import { MessageKind } from '@zapbip/types';
import { CONTACTS_MAX_PER_MESSAGE } from '../constants';
import { invalidInput } from '../inbox-error-factories';
import { sendContent } from './send-content';
import type { SendContactsInput, SendResult } from './types';

export function sendContacts(input: SendContactsInput): Promise<SendResult> {
  const { dependencies, connection, contacts, replyToMessageId } = input;
  const hasValidCount = contacts.length >= 1 && contacts.length <= CONTACTS_MAX_PER_MESSAGE;
  if (!hasValidCount) throw invalidInput({ message: `contacts: must have 1 to ${CONTACTS_MAX_PER_MESSAGE} entries` });
  return sendContent({ dependencies, connection, content: { kind: MessageKind.Contacts, contacts }, replyToMessageId });
}
