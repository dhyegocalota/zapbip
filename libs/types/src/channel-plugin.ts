import { MessageKind } from './enums';

export enum ChannelPluginProduct {
  OpenClaw = 'openclaw',
  Hermes = 'hermes',
}

export const CHANNEL_PLUGIN_PACKAGE_NAME: Record<ChannelPluginProduct, string> = {
  [ChannelPluginProduct.OpenClaw]: '@zapbip/openclaw-plugin',
  [ChannelPluginProduct.Hermes]: 'zapbip-platform',
};

export const CHANNEL_HANDOFF_NO_TEXT_BY_KIND: Record<MessageKind, string> = {
  [MessageKind.Text]: 'The owner sent a message with no text.',
  [MessageKind.Image]: 'The owner sent an image without a caption.',
  [MessageKind.Video]: 'The owner sent a video without a caption.',
  [MessageKind.Audio]: 'The owner sent an audio message.',
  [MessageKind.Document]: 'The owner sent a document without a caption.',
  [MessageKind.Sticker]: 'The owner sent a sticker.',
  [MessageKind.Location]: 'The owner sent a location.',
  [MessageKind.Contacts]: 'The owner sent a contact card.',
  [MessageKind.Reaction]: 'The owner reacted to a message.',
  [MessageKind.Choice]: 'The owner sent a reply with no option selected.',
};

export const CHANNEL_PLUGIN_SELF_TEST_TEXT = '✅ instalado';
