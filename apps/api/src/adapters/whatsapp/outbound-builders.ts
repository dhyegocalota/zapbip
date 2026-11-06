import type { MediaStore, Message, Question } from '@zapbip/core';
import type { OwnerLocale, TemplateKind } from '@zapbip/types';

export function buildSessionPayload(input: {
  recipientWaId: string;
  message: Message;
  question: Question | null;
  replyToChannelMessageId: string | null;
  reactionTargetChannelMessageId: string | null;
  publicOrigin: string;
  mediaStore: MediaStore;
  accountId: string;
}): Promise<Record<string, unknown>> {
  void input;
  throw new Error('buildSessionPayload is not implemented');
}

export function buildTemplatePayload(input: {
  recipientWaId: string;
  kind: TemplateKind;
  locale: OwnerLocale;
  parameters: string[];
}): Record<string, unknown> {
  void input;
  throw new Error('buildTemplatePayload is not implemented');
}
