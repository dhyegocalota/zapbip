import type { ConnectionIdentity, MediaStore } from '@zapbip/core';
import type { z } from 'zod';
import type { AccountInboxRpc } from '../contract/account-inbox-rpc';
import type { INLINE_IMAGE_CONTENT_TYPE } from '../contract/constants';
import type { messageWireSchema } from '../contract/mcp-schemas';

export type MessageWire = z.infer<typeof messageWireSchema>;

export type ToolContext = {
  connection: ConnectionIdentity;
  secret: string;
  origin: string;
  accountInbox: AccountInboxRpc;
  mediaStore: MediaStore;
};

export type InlineImage = { type: typeof INLINE_IMAGE_CONTENT_TYPE; data: string; mimeType: string };

export type ToolSuccess = {
  structured: Record<string, unknown>;
  images: InlineImage[];
};
