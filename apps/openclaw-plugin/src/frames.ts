import type { HelloFrame, MessagesFrame, ServerFrame } from '@zapbip/core';
import { CONNECTOR_FRAME_MAX_BYTES, ConnectorFrameType, FrameRejectionReason } from '@zapbip/types';

export type ServerFrameParse = { ok: true; frame: ServerFrame } | { ok: false; reason: FrameRejectionReason };

type FrameBody = Record<string, unknown>;
type FrameParsers = Record<string, (input: { body: FrameBody }) => ServerFrame | null>;

function asRecord(input: { value: unknown }): FrameBody | null {
  if (typeof input.value !== 'object' || input.value === null || Array.isArray(input.value)) return null;
  return input.value as FrameBody;
}

function parseJson(input: { text: string }): unknown {
  try {
    return JSON.parse(input.text);
  } catch {
    return null;
  }
}

const FRAME_PARSERS: FrameParsers = {
  [ConnectorFrameType.Hello]: ({ body }) => {
    if (typeof body.agent !== 'string' || typeof body.previousWakeMode !== 'string') return null;
    return body as unknown as HelloFrame;
  },
  [ConnectorFrameType.Messages]: ({ body }) => {
    const { messages } = body;
    const hasMessageIds =
      Array.isArray(messages) && messages.every((message) => typeof asRecord({ value: message })?.messageId === 'string');
    if (!hasMessageIds) return null;
    return body as unknown as MessagesFrame;
  },
};

export function parseServerFrame(input: { text: string; byteLength: number; isBinary: boolean }): ServerFrameParse {
  if (input.isBinary) return { ok: false, reason: FrameRejectionReason.BinaryFrame };
  if (input.byteLength > CONNECTOR_FRAME_MAX_BYTES) return { ok: false, reason: FrameRejectionReason.FrameTooLarge };
  const body = asRecord({ value: parseJson({ text: input.text }) });
  if (body === null) return { ok: false, reason: FrameRejectionReason.Malformed };
  const parseFrame = FRAME_PARSERS[String(body.type)];
  if (parseFrame === undefined) return { ok: false, reason: FrameRejectionReason.UnknownType };
  const frame = parseFrame({ body });
  if (frame === null) return { ok: false, reason: FrameRejectionReason.Malformed };
  return { ok: true, frame };
}
