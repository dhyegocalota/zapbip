import type { ConnectorFrameType, WakeMode } from '@zapbip/types';
import type { AgentName } from './connection';
import type { Message } from './message';

export type HelloFrame = {
  type: ConnectorFrameType.Hello;
  agent: AgentName;
  previousWakeMode: WakeMode;
};

export type MessagesFrame = {
  type: ConnectorFrameType.Messages;
  messages: Message[];
};

export type DoneFrame = {
  type: ConnectorFrameType.Done;
  messageId: string;
};

export type ServerFrame = HelloFrame | MessagesFrame;
