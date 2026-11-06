import type { AgentName, DoneFrame, ServerFrame } from '@zapbip/core';
import { CONNECTOR_FRAME_MAX_BYTES, ConnectorFrameType, FrameRejectionReason, REPLACED_CLOSE_CODE } from '@zapbip/types';

export type DoneFrameParse = { ok: true; frame: DoneFrame } | { ok: false; reason: FrameRejectionReason };

const textEncoder = new TextEncoder();

function reject(input: { reason: FrameRejectionReason }): DoneFrameParse {
  return { ok: false, reason: input.reason };
}

function parseJson(input: { text: string }): unknown {
  try {
    return JSON.parse(input.text);
  } catch {
    return null;
  }
}

export function acceptConnectorSocket(input: { context: DurableObjectState; agent: AgentName }): WebSocket {
  const { context, agent } = input;
  context.getWebSockets(agent).forEach((previous) => previous.close(REPLACED_CLOSE_CODE));
  const { 0: client, 1: server } = new WebSocketPair();
  context.acceptWebSocket(server, [agent]);
  return client;
}

export function sendFrameToAgent(input: { context: DurableObjectState; agent: AgentName; frame: ServerFrame }): number {
  const sockets = input.context.getWebSockets(input.agent);
  const text = JSON.stringify(input.frame);
  sockets.forEach((socket) => socket.send(text));
  return sockets.length;
}

export function connectorAgentOf(input: { context: DurableObjectState; socket: WebSocket }): AgentName {
  const [agent] = input.context.getTags(input.socket);
  if (agent === undefined) throw new Error('connector socket has no agent tag');
  return agent;
}

export function remainingSocketCount(input: { context: DurableObjectState; agent: AgentName; closing: WebSocket }): number {
  return input.context.getWebSockets(input.agent).filter((socket) => socket !== input.closing).length;
}

export function parseDoneFrame(input: { data: string | ArrayBuffer }): DoneFrameParse {
  const { data } = input;
  if (typeof data !== 'string') return reject({ reason: FrameRejectionReason.BinaryFrame });
  if (textEncoder.encode(data).byteLength > CONNECTOR_FRAME_MAX_BYTES) return reject({ reason: FrameRejectionReason.FrameTooLarge });
  const parsed = parseJson({ text: data });
  const isObject = typeof parsed === 'object' && parsed !== null;
  if (!isObject) return reject({ reason: FrameRejectionReason.Malformed });
  const { type, messageId } = parsed as { type?: unknown; messageId?: unknown };
  if (type !== ConnectorFrameType.Done) return reject({ reason: FrameRejectionReason.UnknownType });
  if (typeof messageId !== 'string') return reject({ reason: FrameRejectionReason.Malformed });
  return { ok: true, frame: { type: ConnectorFrameType.Done, messageId } };
}
