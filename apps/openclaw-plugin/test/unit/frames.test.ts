import { ConnectorFrameType, FrameRejectionReason } from '@zapbip/types';
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

  it('rejects a raw __proto__ type in the JSON text as an unknown type', () => {
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
});
