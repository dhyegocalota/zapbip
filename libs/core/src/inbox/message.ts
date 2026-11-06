import type { DeliveryState, MediaSourceKind, MessageDirection, MessageKind } from '@zapbip/types';
import type { AgentName } from './connection';

export type ContactCard = {
  name: string;
  phones: string[];
  emails: string[];
  organization: string | null;
};

export type QuestionOption = {
  optionIndex: number;
  title: string;
  description: string | null;
  rowId?: string;
};

export type MediaSource =
  { kind: MediaSourceKind.Link; link: string } | { kind: MediaSourceKind.Stored; mediaId: string } | { kind: MediaSourceKind.Unavailable };

export type MediaFields = {
  source: MediaSource;
  mimeType: string | null;
  sizeBytes: number | null;
  filename: string | null;
  caption: string | null;
};

export type MessageContent =
  | { kind: MessageKind.Text; text: string }
  | ({ kind: MessageKind.Image } & MediaFields)
  | ({ kind: MessageKind.Video } & MediaFields)
  | ({ kind: MessageKind.Audio; voice: boolean } & MediaFields)
  | ({ kind: MessageKind.Document } & MediaFields)
  | ({ kind: MessageKind.Sticker } & MediaFields)
  | { kind: MessageKind.Location; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: MessageKind.Contacts; contacts: ContactCard[] }
  | { kind: MessageKind.Reaction; targetMessageId: string; emoji: string | null }
  | { kind: MessageKind.Choice; questionId: string; options: QuestionOption[]; selected: QuestionOption | null };

export type MessageEnvelope = {
  messageId: string;
  direction: MessageDirection;
  agent: AgentName | null;
  at: number;
  replyToMessageId: string | null;
  delivery: DeliveryState | null;
  readByAgent: boolean;
};

export type Message = MessageEnvelope & MessageContent;
