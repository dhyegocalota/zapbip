import { WEBHOOK_SIGNATURE_HEADER } from '../../../src/adapters/whatsapp/whatsapp-constants';
import { WHATSAPP_WEBHOOK_PATH } from '../../../src/contract/constants';
import { signatureHeaderOf } from '../../fixtures/whatsapp/inbound/signed-webhook';
import { notificationWith } from '../../fixtures/whatsapp/inbound/notification';
import { FakeGraph, type RecordedRequest } from '../../support/fake-graph';
import { stack } from '../stack';
import { APP_SECRET, FAKE_GRAPH_PORT, GRAPH_MESSAGES_PATH } from './constants';

const MILLISECONDS_PER_SECOND = 1000;
const FAKE_MESSAGE_ID_PREFIX = 'wamid.fake';

export const fakeGraph = new FakeGraph({ baseUrl: `http://127.0.0.1:${FAKE_GRAPH_PORT}` });

export function timestampOf(input: { offsetMs: number }): string {
  return String(Math.floor((Date.now() + input.offsetMs) / MILLISECONDS_PER_SECOND));
}

export async function postSignedWebhook(input: { notification: object }): Promise<Response> {
  const body = new TextEncoder().encode(JSON.stringify(input.notification));
  const signature = await signatureHeaderOf({ appSecret: APP_SECRET, body });
  return fetch(`${stack().origin}${WHATSAPP_WEBHOOK_PATH}`, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body });
}

export function postSignedMessage(input: { message: object; offsetMs: number }): Promise<Response> {
  const message = { ...input.message, timestamp: timestampOf({ offsetMs: input.offsetMs }) };
  return postSignedWebhook({ notification: notificationWith({ messages: [message] }) });
}

export async function sentRequests(): Promise<RecordedRequest[]> {
  return (await fakeGraph.requests()).filter((request) => request.path === GRAPH_MESSAGES_PATH);
}

export async function lastSentWamid(): Promise<string> {
  return `${FAKE_MESSAGE_ID_PREFIX}.${(await sentRequests()).length}`;
}
