import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { INLINE_IMAGE_MAX_BYTES } from '@zapbip/core';
import { MessageKind } from '@zapbip/types';
import { INLINE_IMAGE_CONTENT_TYPE } from '../../src/contract/constants';
import { McpToolName } from '../../src/contract/tool-definitions';
import {
  callTool,
  connectClient,
  openWindow,
  ownerWrites,
  seedConnectionWithSecret,
  storeOwnerImage,
  type ToolResult,
} from './mcp-fixtures';
import { applyDirectoryMigration } from '../support/seed';
import { reset } from 'cloudflare:test';

const ACCOUNT_ID = 'acc_1';
const IMAGE_MIME_TYPE = 'image/jpeg';

describe('MCP inline images', () => {
  let client: Client;

  async function readOwnerImage(input: { mediaId: string; sizeBytes: number }): Promise<ToolResult> {
    await storeOwnerImage({ accountId: ACCOUNT_ID, mediaId: input.mediaId, sizeBytes: input.sizeBytes, mimeType: IMAGE_MIME_TYPE });
    await ownerWrites({
      accountId: ACCOUNT_ID,
      channelMessageId: input.mediaId,
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: input.mediaId,
        mimeType: IMAGE_MIME_TYPE,
        sizeBytes: input.sizeBytes,
        filename: null,
        caption: null,
      },
    });
    return callTool({ client, name: McpToolName.GetMessages, arguments: {} });
  }

  function firstUnreadUrl(result: ToolResult): unknown {
    return (result.structuredContent?.unread as { url: string | null }[])[0]?.url;
  }

  afterEach(reset);

  beforeEach(async () => {
    await applyDirectoryMigration();
    const connection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: 'alpha' });
    client = await connectClient({ secret: connection.secret });
    await openWindow({ client, accountId: ACCOUNT_ID });
  });

  it('returns an image block and a link for an image at the inline limit', async () => {
    const result = await readOwnerImage({ mediaId: 'wamid.small', sizeBytes: INLINE_IMAGE_MAX_BYTES });
    const imageBlocks = result.content.filter((block) => block.type === INLINE_IMAGE_CONTENT_TYPE);
    expect(imageBlocks).toHaveLength(1);
    expect(imageBlocks[0]?.mimeType).toBe(IMAGE_MIME_TYPE);
    expect(firstUnreadUrl(result)).toBeTruthy();
  });

  it('returns only a link for an image over the inline limit', async () => {
    const result = await readOwnerImage({ mediaId: 'wamid.large', sizeBytes: INLINE_IMAGE_MAX_BYTES + 1 });
    expect(result.content.filter((block) => block.type === INLINE_IMAGE_CONTENT_TYPE)).toHaveLength(0);
    expect(firstUnreadUrl(result)).toBeTruthy();
  });
});
