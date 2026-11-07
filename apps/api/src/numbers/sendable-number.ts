import { ChannelError } from '@zapbip/core';
import { ChannelErrorKind, WhatsAppNumberState } from '@zapbip/types';
import { logOperatorEvent } from '../adapters/whatsapp/operator-log';
import { OperatorEvent, OperatorLogField } from '../adapters/whatsapp/whatsapp-enums';
import type { NumberRegistry, OutboundNumber } from './number-registry';

const SENDABLE_STATES: WhatsAppNumberState[] = [WhatsAppNumberState.Active, WhatsAppNumberState.Closed];
const UNAVAILABLE_MESSAGE = 'sending is paused because the WhatsApp number of this account is unavailable';

function unavailable(input: { reason: string }): ChannelError {
  logOperatorEvent({ event: OperatorEvent.ChannelNumberUnavailable, fields: { [OperatorLogField.Reason]: input.reason } });
  return new ChannelError({ kind: ChannelErrorKind.Restricted, message: UNAVAILABLE_MESSAGE, errorCode: null });
}

export async function openSendableNumber(input: { registry: NumberRegistry; accountId: string }): Promise<OutboundNumber> {
  const number = await input.registry.openForAccount({ accountId: input.accountId }).catch((error: unknown) => {
    throw unavailable({ reason: error instanceof Error ? error.message : String(error) });
  });
  if (!SENDABLE_STATES.includes(number.state)) throw unavailable({ reason: `number ${number.numberId} is ${number.state}` });
  return number;
}
