import type { AgentName, DoneFrame, ServerFrame } from '@zapbip/core';
import type { FrameRejectionReason } from '@zapbip/types';

export function acceptConnectorSocket(input: { context: DurableObjectState; agent: AgentName }): WebSocket {
  void input;
  throw new Error('acceptConnectorSocket is not implemented');
}

export function sendFrameToAgent(input: { context: DurableObjectState; agent: AgentName; frame: ServerFrame }): number {
  void input;
  throw new Error('sendFrameToAgent is not implemented');
}

export function connectorAgentOf(input: { context: DurableObjectState; socket: WebSocket }): AgentName {
  void input;
  throw new Error('connectorAgentOf is not implemented');
}

export function remainingSocketCount(input: { context: DurableObjectState; agent: AgentName; closing: WebSocket }): number {
  void input;
  throw new Error('remainingSocketCount is not implemented');
}

export type DoneFrameParse = { ok: true; frame: DoneFrame } | { ok: false; reason: FrameRejectionReason };

export function parseDoneFrame(input: { data: string | ArrayBuffer }): DoneFrameParse {
  void input;
  throw new Error('parseDoneFrame is not implemented');
}
