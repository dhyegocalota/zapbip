import { DeliveryState, MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { ChannelStatusDetail } from '../inbox-records';
import { createEnvironment } from '../testing/fixtures';
import { applyStatus } from './apply-status';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

const WAMID = 'wamid.S';
const NO_DETAIL: ChannelStatusDetail = { errorCode: null, errorTitle: null, pricingCategory: null, billable: null };

async function storeOutbound(input: { environment: Environment; delivery: DeliveryState }): Promise<string> {
  const { environment, delivery } = input;
  const messageId = 'msg_out';
  await environment.repository.insertMessage({
    message: {
      messageId,
      direction: MessageDirection.ToOwner,
      agent: 'alpha',
      at: environment.clock.now(),
      replyToMessageId: null,
      delivery,
      readByAgent: true,
      kind: MessageKind.Text,
      text: 'hello',
    },
  });
  await environment.repository.saveChannelMessageId({ messageId, channelMessageId: WAMID });
  return messageId;
}

function apply(input: {
  environment: Environment;
  status: Parameters<typeof applyStatus>[0]['status'];
  detail?: Partial<ChannelStatusDetail>;
  channelMessageId?: string;
}) {
  const { environment, status, detail = {}, channelMessageId = WAMID } = input;
  return applyStatus({ dependencies: environment.dependencies, channelMessageId, status, detail: { ...NO_DETAIL, ...detail } });
}

async function deliveryOf(input: { environment: Environment; messageId: string }): Promise<DeliveryState | null> {
  const message = await input.environment.repository.findMessage({ messageId: input.messageId });
  if (message === null) throw new Error('expected the message to exist');
  return message.delivery;
}

describe('applyStatus', () => {
  test('CU-27 a read status updates the message', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Sent });
    expect(await apply({ environment, status: DeliveryState.Read })).toEqual({ applied: true });
    expect(await deliveryOf({ environment, messageId })).toBe(DeliveryState.Read);
  });

  test('CU-28 a lower status after a higher one is applied as a no-op', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Read });
    expect(await apply({ environment, status: DeliveryState.Delivered })).toEqual({ applied: true });
    expect(await deliveryOf({ environment, messageId })).toBe(DeliveryState.Read);
  });

  test('CU-29 a failure stores its code and title', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Sent });
    await apply({ environment, status: DeliveryState.Failed, detail: { errorCode: 131026, errorTitle: 'Message undeliverable' } });
    expect(await deliveryOf({ environment, messageId })).toBe(DeliveryState.Failed);
    expect(environment.repository.findStatusDetail({ messageId })).toMatchObject({
      errorCode: 131026,
      errorTitle: 'Message undeliverable',
    });
  });

  test('CU-30 a status for an unknown channel message id changes nothing', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Sent });
    const result = await apply({
      environment,
      status: DeliveryState.Read,
      channelMessageId: 'wamid.none',
      detail: { pricingCategory: 'service' },
    });
    expect(result).toEqual({ applied: false });
    expect(await deliveryOf({ environment, messageId })).toBe(DeliveryState.Sent);
    expect(environment.repository.findStatusDetail({ messageId })).toBeNull();
  });

  test('CU-31 sent, read, delivered, failed ends read', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Sent });
    await apply({ environment, status: DeliveryState.Read });
    await apply({ environment, status: DeliveryState.Delivered });
    await apply({ environment, status: DeliveryState.Failed, detail: { errorCode: 1, errorTitle: 'late' } });
    expect(await deliveryOf({ environment, messageId })).toBe(DeliveryState.Read);
  });

  test('a failure that is ignored leaves no error detail on the message', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Delivered });
    await apply({ environment, status: DeliveryState.Failed, detail: { errorCode: 131026, errorTitle: 'late' } });
    expect(environment.repository.findStatusDetail({ messageId })).toBeNull();
  });

  test('CU-40 a later status without an error title keeps the stored title', async () => {
    const environment = await createEnvironment();
    const messageId = await storeOutbound({ environment, delivery: DeliveryState.Sent });
    await apply({ environment, status: DeliveryState.Failed, detail: { errorCode: 131026, errorTitle: 'T1' } });
    await apply({ environment, status: DeliveryState.Delivered, detail: { pricingCategory: 'service', billable: false } });
    expect(environment.repository.findStatusDetail({ messageId })).toEqual({
      errorCode: 131026,
      errorTitle: 'T1',
      pricingCategory: 'service',
      billable: false,
    });
  });

  test('a status for an owner message is not applied', async () => {
    const environment = await createEnvironment();
    await environment.repository.insertMessage({
      message: {
        messageId: 'msg_in',
        direction: MessageDirection.FromOwner,
        agent: 'alpha',
        at: environment.clock.now(),
        replyToMessageId: null,
        delivery: null,
        readByAgent: false,
        kind: MessageKind.Text,
        text: 'hi',
      },
    });
    await environment.repository.saveChannelMessageId({ messageId: 'msg_in', channelMessageId: WAMID });
    expect(await apply({ environment, status: DeliveryState.Read })).toEqual({ applied: false });
  });
});
