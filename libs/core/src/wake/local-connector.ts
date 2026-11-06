import type { WakeMode } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { Message } from '../inbox/message';
import type { WakeContext } from './wake-ports';

export type AttachLocalConnectorInput = WakeContext & {
  agent: AgentName;
  limit: number;
};

export type AttachLocalConnectorResult = {
  previousWakeMode: WakeMode;
  unread: Message[];
};

export type DetachLocalConnectorInput = WakeContext & {
  agent: AgentName;
  remainingSockets: number;
};

export async function attachLocalConnector(input: AttachLocalConnectorInput): Promise<AttachLocalConnectorResult> {
  void input;
  throw new Error('attachLocalConnector is not implemented');
}

export async function detachLocalConnector(input: DetachLocalConnectorInput): Promise<void> {
  void input;
  throw new Error('detachLocalConnector is not implemented');
}
