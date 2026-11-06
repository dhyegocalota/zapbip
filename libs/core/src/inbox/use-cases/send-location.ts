import { MessageKind } from '@zapbip/types';
import { invalidInput } from '../inbox-error-factories';
import { sendContent } from './send-content';
import type { SendLocationInput, SendResult } from './types';

const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;

function assertWithin(input: { field: string; value: number; limit: number }): void {
  if (Math.abs(input.value) > input.limit)
    throw invalidInput({ message: `${input.field}: must be between -${input.limit} and ${input.limit}` });
}

export function sendLocation(input: SendLocationInput): Promise<SendResult> {
  const { dependencies, connection, latitude, longitude, name, address, replyToMessageId } = input;
  assertWithin({ field: 'latitude', value: latitude, limit: LATITUDE_LIMIT });
  assertWithin({ field: 'longitude', value: longitude, limit: LONGITUDE_LIMIT });
  return sendContent({
    dependencies,
    connection,
    content: { kind: MessageKind.Location, latitude, longitude, name, address },
    replyToMessageId,
  });
}
