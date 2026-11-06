import { CONNECTOR_FRAME_MAX_BYTES, ConnectorFrameType, FrameRejectionReason, RECONNECT_MAX_MS } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { deriveConnectorLinks, parseServerFrame, reconnectDelayMs } from '../../src/connect';
import { framePaddedToBytes, ownerTextMessage } from '../support/fake-event-server';

const MCP_LINK = 'https://zapbip.example/c/abc123/mcp';

function parseText(input: { text: string }) {
  return parseServerFrame({ text: input.text, byteLength: Buffer.byteLength(input.text), isBinary: false });
}

describe('deriveConnectorLinks', () => {
  it('derives the socket link and the probe link from an MCP link', () => {
    expect(deriveConnectorLinks({ connectionLink: MCP_LINK })).toEqual({
      probeLink: 'https://zapbip.example/c/abc123/connector',
      socketLink: 'wss://zapbip.example/c/abc123/connector',
    });
  });

  it('refuses a link without the MCP suffix and never echoes it', () => {
    const link = 'https://zapbip.example/c/abc123';
    expect(() => deriveConnectorLinks({ connectionLink: link })).toThrow();
    expect(() => deriveConnectorLinks({ connectionLink: link })).not.toThrow(/abc123/);
  });

  it('refuses a plain http link', () => {
    expect(() => deriveConnectorLinks({ connectionLink: 'http://zapbip.example/c/abc123/mcp' })).toThrow();
  });
});

describe('reconnectDelayMs', () => {
  const noJitter = () => 0;
  const fullJitter = () => 0.999;

  it.each([
    [0, 1_000],
    [1, 2_000],
    [2, 4_000],
    [5, RECONNECT_MAX_MS],
    [6, RECONNECT_MAX_MS],
  ])('attempt %i waits %i ms without jitter', (attempt, expected) => {
    expect(reconnectDelayMs({ attempt, random: noJitter })).toBe(expected);
  });

  it('adds up to half of the delay as jitter', () => {
    expect(reconnectDelayMs({ attempt: 0, random: fullJitter })).toBe(1_499);
    expect(reconnectDelayMs({ attempt: 1, random: () => 0.5 })).toBe(2_500);
  });

  it('never exceeds the maximum, jitter included', () => {
    expect(reconnectDelayMs({ attempt: 9, random: fullJitter })).toBe(RECONNECT_MAX_MS);
  });

  it('refuses a negative attempt', () => {
    expect(() => reconnectDelayMs({ attempt: -1, random: noJitter })).toThrow();
  });
});

describe('parseServerFrame', () => {
  it('accepts a messages frame', () => {
    const message = ownerTextMessage({ messageId: 'msg_1', text: 'Oi' });
    const text = JSON.stringify({ type: ConnectorFrameType.Messages, messages: [message] });
    expect(parseText({ text })).toEqual({ ok: true, frame: { type: ConnectorFrameType.Messages, messages: [message] } });
  });

  it('accepts a hello frame', () => {
    const frame = { type: ConnectorFrameType.Hello, agent: 'ana', previousWakeMode: 'none' };
    expect(parseText({ text: JSON.stringify(frame) })).toEqual({ ok: true, frame });
  });

  it('rejects a binary frame', () => {
    const text = JSON.stringify({ type: ConnectorFrameType.Messages, messages: [] });
    expect(parseServerFrame({ text, byteLength: Buffer.byteLength(text), isBinary: true })).toEqual({
      ok: false,
      reason: FrameRejectionReason.BinaryFrame,
    });
  });

  it('rejects a text frame one byte over the limit', () => {
    const text = framePaddedToBytes({ byteLength: CONNECTOR_FRAME_MAX_BYTES + 1 });
    expect(parseServerFrame({ text, byteLength: Buffer.byteLength(text), isBinary: false })).toEqual({
      ok: false,
      reason: FrameRejectionReason.FrameTooLarge,
    });
  });

  it('accepts a text frame of exactly the limit', () => {
    const text = framePaddedToBytes({ byteLength: CONNECTOR_FRAME_MAX_BYTES });
    expect(Buffer.byteLength(text)).toBe(CONNECTOR_FRAME_MAX_BYTES);
    expect(parseServerFrame({ text, byteLength: Buffer.byteLength(text), isBinary: false }).ok).toBe(true);
  });

  it('rejects text that is not JSON', () => {
    expect(parseText({ text: 'not json' })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });

  it('rejects JSON that is not an object', () => {
    expect(parseText({ text: '[]' })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });

  it('rejects an unknown type', () => {
    expect(parseText({ text: JSON.stringify({ type: 'surprise' }) })).toEqual({ ok: false, reason: FrameRejectionReason.UnknownType });
  });

  it('rejects a messages frame whose list is missing', () => {
    expect(parseText({ text: JSON.stringify({ type: ConnectorFrameType.Messages }) })).toEqual({
      ok: false,
      reason: FrameRejectionReason.Malformed,
    });
  });

  it('rejects a message without a message id', () => {
    const { messageId, ...withoutId } = ownerTextMessage({ messageId: 'msg_1', text: 'Oi' });
    expect(messageId).toBe('msg_1');
    const text = JSON.stringify({ type: ConnectorFrameType.Messages, messages: [withoutId] });
    expect(parseText({ text })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });
});
