import type { AgentName, DoneFrame, Message, ServerFrame } from '@zapbip/core';
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

function isOpenOrConnecting(socket: WebSocket): boolean {
  return socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED;
}

export function acceptConnectorSocket(input: { context: DurableObjectState; agent: AgentName }): WebSocket {
  const { context, agent } = input;
  context.getWebSockets(agent).forEach((previous) => previous.close(REPLACED_CLOSE_CODE));
  const { 0: client, 1: server } = new WebSocketPair();
  context.acceptWebSocket(server, [agent]);
  return client;
}

export function sendFrameToAgent(input: { context: DurableObjectState; agent: AgentName; frame: ServerFrame }): number {
  const sockets = input.context.getWebSockets(input.agent).filter(isOpenOrConnecting);
  const text = JSON.stringify(input.frame);
  sockets.forEach((socket) => socket.send(text));
  return sockets.length;
}

export function hasLiveConnectorSocket(input: { context: DurableObjectState; agent: AgentName }): boolean {
  return input.context.getWebSockets(input.agent).some(isOpenOrConnecting);
}

export function connectorAgentOf(input: { context: DurableObjectState; socket: WebSocket }): AgentName {
  const [agent] = input.context.getTags(input.socket);
  if (agent === undefined) throw new Error('connector socket has no agent tag');
  return agent;
}

export function remainingSocketCount(input: { context: DurableObjectState; agent: AgentName; closing: WebSocket }): number {
  return input.context.getWebSockets(input.agent).filter((socket) => socket !== input.closing && isOpenOrConnecting(socket)).length;
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

export type MessageFramePlan = { frames: Message[][]; oversized: Message[] };
export type MessagesDelivery = { socketCount: number; oversizedCount: number };

function frameBytesOf(input: { messages: Message[] }): number {
  const frame: ServerFrame = { type: ConnectorFrameType.Messages, messages: input.messages };
  return textEncoder.encode(JSON.stringify(frame)).byteLength;
}

function fitsInFrame(input: { messages: Message[] }): boolean {
  return frameBytesOf(input) <= CONNECTOR_FRAME_MAX_BYTES;
}

export function planMessageFrames(input: { messages: Message[] }): MessageFramePlan {
  const oversized = input.messages.filter((message) => !fitsInFrame({ messages: [message] }));
  const frames = input.messages
    .filter((message) => fitsInFrame({ messages: [message] }))
    .reduce<Message[][]>((planned, message) => {
      const current = planned.at(-1);
      if (current === undefined || !fitsInFrame({ messages: [...current, message] })) return [...planned, [message]];
      return [...planned.slice(0, -1), [...current, message]];
    }, []);
  return { frames, oversized };
}

export function sendMessagesToAgent(input: { context: DurableObjectState; agent: AgentName; messages: Message[] }): MessagesDelivery {
  const { context, agent, messages } = input;
  const plan = planMessageFrames({ messages });
  const socketCounts = plan.frames.map((framed) =>
    sendFrameToAgent({ context, agent, frame: { type: ConnectorFrameType.Messages, messages: framed } }),
  );
  return { socketCount: Math.max(0, ...socketCounts), oversizedCount: plan.oversized.length };
}
