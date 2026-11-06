import { afterEach, describe, expect, expectTypeOf, it, vi, type MockInstance } from 'vitest';
import { logOperatorEvent } from '../../src/adapters/whatsapp/operator-log';
import { OperatorEvent, OperatorLogField, WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedLines(input: { spy: MockInstance<typeof console.error> }): unknown[] {
  return input.spy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

describe('logOperatorEvent', () => {
  it('AU-121 writes one error line with the event and the code', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logOperatorEvent({ event: OperatorEvent.ChannelRestricted, fields: { [OperatorLogField.ErrorCode]: 131_048 } });
    expect(loggedLines({ spy })).toEqual([{ event: 'channel.restricted', error_code: 131_048 }]);
  });

  it('AU-122 writes exactly the fields given', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logOperatorEvent({
      event: OperatorEvent.ChannelTemplateRejected,
      fields: {
        [OperatorLogField.TemplateName]: WhatsAppTemplateName.AgentNotice,
        [OperatorLogField.LanguageCode]: WhatsAppLanguageCode.EnglishUs,
      },
    });
    expect(loggedLines({ spy })).toEqual([
      { event: 'channel.template_rejected', template_name: 'zapbip_agent_notice', language_code: 'en_US' },
    ]);
  });

  it('writes an event with no fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logOperatorEvent({ event: OperatorEvent.ChannelTimeout, fields: {} });
    expect(loggedLines({ spy })).toEqual([{ event: 'channel.timeout' }]);
  });

  it('keys the fields by the enum only', () => {
    type Fields = Parameters<typeof logOperatorEvent>[0]['fields'];
    expectTypeOf<Fields>().not.toHaveProperty('phone');
    expectTypeOf<Fields>().toHaveProperty(OperatorLogField.ErrorCode);
  });
});
