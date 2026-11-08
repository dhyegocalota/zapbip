import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { peekWebhookRouting } from '../../src/adapters/whatsapp/webhook-routing-peek';
import { changeOf, notificationOf, notificationWith, OUR_PHONE_NUMBER_ID } from '../fixtures/whatsapp/inbound/notification';

type Fixture = { path: string; body: object };

const WABA_ID = '3000000000000003';
const OTHER_PHONE_NUMBER_ID = '2000000000000002';
const TEMPLATE_STATUS_FIELD = 'message_template_status_update';
const JSON_EXTENSION = '.json';

function fixturesIn(input: { directory: string }): Fixture[] {
  const directoryPath = join(import.meta.dirname, '..', 'fixtures', 'whatsapp', input.directory);
  return readdirSync(directoryPath)
    .filter((name) => name.endsWith(JSON_EXTENSION))
    .map((name) => ({ path: `${input.directory}/${name}`, body: JSON.parse(readFileSync(join(directoryPath, name), 'utf8')) as object }));
}

const inboundFixtures = fixturesIn({ directory: 'inbound' });
const statusFixtures = fixturesIn({ directory: 'status' });

function textOf(input: { notification: object }): string {
  return JSON.stringify(input.notification);
}

describe('the webhook routing peek', () => {
  it('has fixtures to walk', () => {
    expect(inboundFixtures.length).toBeGreaterThan(0);
    expect(statusFixtures.length).toBeGreaterThan(0);
  });

  it.each(inboundFixtures)('routes the inbound fixture $path by its phone number id', (fixture) => {
    const text = textOf({ notification: notificationWith({ messages: [fixture.body] }) });
    expect(peekWebhookRouting({ text })).toEqual({ phoneNumberIds: [OUR_PHONE_NUMBER_ID], wabaIds: [] });
  });

  it.each(statusFixtures)('routes the status fixture $path by its phone number id', (fixture) => {
    const text = textOf({ notification: notificationWith({ statuses: [fixture.body] }) });
    expect(peekWebhookRouting({ text })).toEqual({ phoneNumberIds: [OUR_PHONE_NUMBER_ID], wabaIds: [] });
  });

  it('routes a change without metadata by the WABA id of its entry', () => {
    const templateStatus = { field: TEMPLATE_STATUS_FIELD, value: { event: 'APPROVED', message_template_name: 'zapbip_agent_notice' } };
    const text = textOf({ notification: notificationOf({ changes: [templateStatus] }) });
    expect(peekWebhookRouting({ text })).toEqual({ phoneNumberIds: [], wabaIds: [WABA_ID] });
  });

  it('collects every distinct id of a delivery that spans two numbers', () => {
    const changes = [
      changeOf({ phoneNumberId: OUR_PHONE_NUMBER_ID }),
      changeOf({ phoneNumberId: OTHER_PHONE_NUMBER_ID }),
      changeOf({ phoneNumberId: OUR_PHONE_NUMBER_ID }),
      changeOf({ phoneNumberId: null }),
    ];
    const text = textOf({ notification: notificationOf({ changes }) });
    expect(peekWebhookRouting({ text })).toEqual({ phoneNumberIds: [OUR_PHONE_NUMBER_ID, OTHER_PHONE_NUMBER_ID], wabaIds: [WABA_ID] });
  });

  it('returns null for invalid JSON', () => {
    expect(peekWebhookRouting({ text: '{not json' })).toBeNull();
  });

  it('returns null when nothing is routable', () => {
    expect(peekWebhookRouting({ text: '{}' })).toBeNull();
    expect(peekWebhookRouting({ text: '[]' })).toBeNull();
    expect(peekWebhookRouting({ text: textOf({ notification: { entry: [{ changes: [{ field: 'messages', value: {} }] }] } }) })).toBeNull();
    expect(peekWebhookRouting({ text: textOf({ notification: notificationOf({ changes: [] }) }) })).toBeNull();
  });
});
