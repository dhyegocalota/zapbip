import { MessageKind } from '@zapbip/types';
import type { MediaMessageKind } from '../constants';
import type { MediaFields, MessageContent } from '../message';

export function buildMediaContent(input: { mediaKind: MediaMessageKind; voice: boolean; fields: MediaFields }): MessageContent {
  const { mediaKind, voice, fields } = input;
  if (mediaKind === MessageKind.Audio) return { kind: MessageKind.Audio, voice, ...fields };
  return { kind: mediaKind, ...fields };
}
