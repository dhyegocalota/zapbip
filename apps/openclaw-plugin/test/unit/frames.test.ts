import { CONNECTOR_FRAME_MAX_BYTES, ConnectorFrameType, FrameRejectionReason, MessageKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { parseServerFrame } from '../../src/frames';

const INHERITED_PROPERTY_NAMES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

function parse(input: { body: object }) {
  const text = JSON.stringify(input.body);
  return parseServerFrame({ text, byteLength: Buffer.byteLength(text), isBinary: false });
}

describe('parseServerFrame', () => {
  it.each(INHERITED_PROPERTY_NAMES)('rejects the inherited property name %s as an unknown type', (type) => {
    expect(parse({ body: { type } })).toEqual({ ok: false, reason: FrameRejectionReason.UnknownType });
  });

  it('rejects a raw __proto__ key in the JSON text as an unknown type', () => {
    const text = '{"type":"__proto__"}';
    expect(parseServerFrame({ text, byteLength: text.length, isBinary: false })).toEqual({
      ok: false,
      reason: FrameRejectionReason.UnknownType,
    });
  });

  it('accepts a hello frame', () => {
    const body = { type: ConnectorFrameType.Hello, agent: 'ana', previousWakeMode: 'none' };
    expect(parse({ body })).toEqual({ ok: true, frame: body });
  });

  it('rejects a frame over the limit', () => {
    const text = '{"type":"messages"}';
    expect(parseServerFrame({ text, byteLength: CONNECTOR_FRAME_MAX_BYTES + 1, isBinary: false })).toEqual({
      ok: false,
      reason: FrameRejectionReason.FrameTooLarge,
    });
  });

  it.each([null, 3, undefined])('rejects a hello whose previousWakeMode is %s as malformed', (previousWakeMode) => {
    expect(parse({ body: { type: ConnectorFrameType.Hello, agent: 'ana', previousWakeMode } })).toEqual({
      ok: false,
      reason: FrameRejectionReason.Malformed,
    });
  });

  it.each([undefined, null, 'zzz', 'constructor', 3])('rejects a messages frame with the message kind %s as malformed', (kind) => {
    const message = { messageId: 'msg_1', kind };
    expect(parse({ body: { type: ConnectorFrameType.Messages, messages: [message] } })).toEqual({
      ok: false,
      reason: FrameRejectionReason.Malformed,
    });
  });

  it('accepts a messages frame whose messages have known kinds', () => {
    const body = { type: ConnectorFrameType.Messages, messages: [{ messageId: 'msg_1', kind: MessageKind.Text }] };
    expect(parse({ body })).toEqual({ ok: true, frame: body });
  });
});
