import { formatOptionId, INLINE_IMAGE_MAX_BYTES, NOTICE_QUICK_REPLY_ID, WINDOW_MS } from '@zapbip/core';
import { DeliveryState, MessageKind, ReplyStatus } from '@zapbip/types';
import { describe, expect, it, vi } from 'vitest';
import { INLINE_IMAGE_CONTENT_TYPE } from '../../src/contract/constants';
import { McpToolName } from '../../src/contract/tool-definitions';
import { callTool, type ToolResult } from './mcp-fixtures';
import { getMessages, postOwner, startOwnerSession, type OwnerSession } from './owner-simulator-fixtures';
import { inboxOf } from './route-fixtures';

const JPEG_TYPE = 'image/jpeg';
const JPEG_START = [0xff, 0xd8, 0xff, 0xe0];
const JPEG_END = [0xff, 0xd9];
const BYTE_PERIOD = 251;
const INLINE_PAYLOAD_BYTES = 100 * 1024;
const OVER_INLINE_PAYLOAD_BYTES = 1.1 * 1024 * 1024;
const SMALL_PAYLOAD_BYTES = 2048;
const HELD_ASK_SECONDS = 20;

type UnreadWire = {
  kind: MessageKind;
  media_id: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  voice: boolean | null;
};

function payload(input: { sizeBytes: number }): Buffer {
  const body = Array.from({ length: input.sizeBytes - JPEG_START.length - JPEG_END.length }, (_, index) => index % BYTE_PERIOD);
  return Buffer.from([...JPEG_START, ...body, ...JPEG_END]);
}

function unreadOf(result: ToolResult): UnreadWire[] {
  return result.structuredContent?.unread as UnreadWire[];
}

function inlineBlocks(result: ToolResult) {
  return result.content.filter((block) => block.type === INLINE_IMAGE_CONTENT_TYPE);
}

async function ownerSendsMedia(input: { session: OwnerSession; kind: MessageKind; mimeType: string; bytes: Buffer; voice: boolean }) {
  const wamid = `wamid.${crypto.randomUUID()}`;
  await postOwner({
    session: input.session,
    body: { kind: input.kind, wamid, mime_type: input.mimeType, data_base64: input.bytes.toString('base64'), voice: input.voice },
  });
  return { wamid, result: await getMessages({ session: input.session }) };
}

async function heldQuestionId(input: { session: OwnerSession }): Promise<string> {
  return vi.waitFor(async () => {
    const history = (await getMessages(input)).structuredContent?.history as {
      kind: MessageKind;
      choice: { question_id: string } | null;
    }[];
    const question = history.find((message) => message.kind === MessageKind.Choice);
    if (!question?.choice) throw new Error('question not stored yet');
    return question.choice.question_id;
  });
}

describe('owner simulator on the agent wire', () => {
  it('WI-92 a 100 KB owner image gives a link, its media id and one inline block', async () => {
    const session = await startOwnerSession();
    const bytes = payload({ sizeBytes: INLINE_PAYLOAD_BYTES });
    const { wamid, result } = await ownerSendsMedia({ session, kind: MessageKind.Image, mimeType: JPEG_TYPE, bytes, voice: false });
    const blocks = inlineBlocks(result);
    expect(unreadOf(result)).toMatchObject([
      { kind: MessageKind.Image, media_id: wamid, mime_type: JPEG_TYPE, size_bytes: bytes.byteLength },
    ]);
    expect(unreadOf(result)[0]?.url).toBeTruthy();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ mimeType: JPEG_TYPE, data: bytes.toString('base64') });
  });

  it('WI-93 a 1.1 MB owner image gives a link only', async () => {
    const session = await startOwnerSession();
    const bytes = payload({ sizeBytes: OVER_INLINE_PAYLOAD_BYTES });
    expect(bytes.byteLength).toBeGreaterThan(INLINE_IMAGE_MAX_BYTES);
    const { wamid, result } = await ownerSendsMedia({ session, kind: MessageKind.Image, mimeType: JPEG_TYPE, bytes, voice: false });
    expect(unreadOf(result)).toMatchObject([{ kind: MessageKind.Image, media_id: wamid, size_bytes: bytes.byteLength }]);
    expect(unreadOf(result)[0]?.url).toBeTruthy();
    expect(inlineBlocks(result)).toHaveLength(0);
  });

  it.each([
    { kind: MessageKind.Video, mimeType: 'video/mp4' },
    { kind: MessageKind.Document, mimeType: 'application/pdf' },
    { kind: MessageKind.Sticker, mimeType: 'image/webp' },
  ])('WI-94 an owner $kind gives its media id and a link without an inline block', async ({ kind, mimeType }) => {
    const session = await startOwnerSession();
    const bytes = payload({ sizeBytes: SMALL_PAYLOAD_BYTES });
    const { wamid, result } = await ownerSendsMedia({ session, kind, mimeType, bytes, voice: false });
    expect(unreadOf(result)).toMatchObject([{ kind, media_id: wamid, mime_type: mimeType, size_bytes: bytes.byteLength, voice: null }]);
    expect(unreadOf(result)[0]?.url).toBeTruthy();
    expect(inlineBlocks(result)).toHaveLength(0);
  });

  it.each([
    { voice: true, mimeType: 'audio/ogg' },
    { voice: false, mimeType: 'audio/mpeg' },
  ])('WI-95 an owner audio with voice $voice carries it on the wire', async ({ voice, mimeType }) => {
    const session = await startOwnerSession();
    const { wamid, result } = await ownerSendsMedia({
      session,
      kind: MessageKind.Audio,
      mimeType,
      bytes: payload({ sizeBytes: SMALL_PAYLOAD_BYTES }),
      voice,
    });
    expect(unreadOf(result)).toMatchObject([{ kind: MessageKind.Audio, media_id: wamid, mime_type: mimeType, voice }]);
    expect(unreadOf(result)[0]?.url).toBeTruthy();
  });

  it('WI-100 an owner tap through the simulator answers a held ask', async () => {
    const session = await startOwnerSession();
    const asking = callTool({
      client: session.client,
      name: McpToolName.Ask,
      arguments: { question: 'Vamos?', options: [{ title: 'Sim' }, { title: 'Nao' }], timeout_seconds: HELD_ASK_SECONDS },
    });
    const questionId = await heldQuestionId({ session });
    await postOwner({
      session,
      body: { kind: MessageKind.Choice, option_id: formatOptionId({ questionId, optionIndex: 0 }), title: 'Sim' },
    });
    expect((await asking).structuredContent).toMatchObject({ status: ReplyStatus.Answered, answer: 'Sim' });
  });

  it('WI-102 the notice quick reply only opens the window', async () => {
    const session = await startOwnerSession();
    await inboxOf({ accountId: session.account.accountId }).advanceClock({ advanceMs: WINDOW_MS });
    const queued = await callTool({ client: session.client, name: McpToolName.SendMessage, arguments: { text: 'fila' } });
    expect(queued.structuredContent).toMatchObject({ delivery: DeliveryState.Queued });
    const receipt = await postOwner({
      session,
      body: { kind: MessageKind.Choice, option_id: NOTICE_QUICK_REPLY_ID, title: 'Abrir' },
    });
    const result = await getMessages({ session });
    const history = result.structuredContent?.history as { text: string | null; delivery: DeliveryState | null }[];
    expect(receipt.message_id).toBeNull();
    expect(unreadOf(result)).toHaveLength(0);
    expect(history.find((message) => message.text === 'fila')).toMatchObject({ delivery: DeliveryState.Sent });
  });
});
