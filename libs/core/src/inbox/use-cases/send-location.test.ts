import { DeliveryState, InboxErrorCode, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment } from '../testing/fixtures';
import { sendLocation } from './send-location';

const alpha = connectionOf({ agent: 'alpha' });

async function send(input: { latitude: number; longitude: number }) {
  const environment = await createEnvironment();
  const outcome = await sendLocation({
    dependencies: environment.dependencies,
    connection: alpha,
    latitude: input.latitude,
    longitude: input.longitude,
    name: 'Office',
    address: null,
    replyToMessageId: null,
  });
  return { environment, outcome };
}

describe('sendLocation', () => {
  test('sends a valid location', async () => {
    const { environment, outcome } = await send({ latitude: -23.55, longitude: -46.63 });
    expect(outcome.delivery).toBe(DeliveryState.Sent);
    expect(environment.sender.sessions[0]).toMatchObject({
      kind: MessageKind.Location,
      latitude: -23.55,
      longitude: -46.63,
      name: 'Office',
    });
  });

  test('CU-154 latitude out of range', async () => {
    const error = await captureInboxError(() => send({ latitude: 91, longitude: 0 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'latitude: must be between -90 and 90' });
  });

  test('longitude out of range', async () => {
    const error = await captureInboxError(() => send({ latitude: 0, longitude: -181 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'longitude: must be between -180 and 180' });
  });
});
