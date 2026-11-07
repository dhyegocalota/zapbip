import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HISTORY_LIMIT, ASK_MAX_WAIT_SECONDS, formatOptionId } from '@zapbip/core';
import { DeliveryState, InboxStatus, MessageKind, ReplyStatus, SECOND_MS } from '@zapbip/types';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';
import { McpToolName, TOOL_DEFINITIONS } from '../../src/contract/tool-definitions';
import { messageWireSchema } from '../../src/contract/mcp-schemas';
import {
  callTool,
  connectClient,
  ownerText,
  openWindow,
  ownerWrites,
  receiveUpload,
  seedConnectionWithSecret,
  type ToolResult,
} from './mcp-fixtures';
import { applyDirectoryMigration } from '../support/seed';
import { reset } from 'cloudflare:test';

const ACCOUNT_ID = 'acc_1';
const AGENT = 'alpha';
const LOCATION_LATITUDE_OUT_OF_RANGE = 91;
const TEXT_OVER_LIMIT = 4097;
const LIST_OPTION_OVER_LIMIT = 25;
const BUTTON_OPTION_OVER_LIMIT = 21;
const TIMEOUT_OVER_LIMIT_SECONDS = ASK_MAX_WAIT_SECONDS + 1;
const CONTACT_CARDS_OVER_LIMIT = 11;
const UNREAD_COUNT = 25;
const DOCUMENT_OVER_LIMIT_BYTES = 100_000_001;
const STICKER_LIMIT_BYTES = 100_000;
const SHORT_WAIT_SECONDS = 1;
const HELD_ASK_SECONDS = 20;
const HELD_QUESTION_WAIT_MS = (HELD_ASK_SECONDS * SECOND_MS) / 2;
const CONCURRENT_CALL_DEADLINE_MS = 3000;
const CONCURRENT_CALL_TIMED_OUT = 'timed out';
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

describe('MCP tools', () => {
  let client: Client;

  const inFlightCalls: Promise<ToolResult>[] = [];

  async function call(input: { name: McpToolName; arguments: Record<string, unknown> }): Promise<ToolResult> {
    const inFlightCall = callTool({ client, name: input.name, arguments: input.arguments });
    inFlightCalls.push(inFlightCall);
    return inFlightCall;
  }

  async function sendText(text: string): Promise<ToolResult> {
    return call({ name: McpToolName.SendMessage, arguments: { text } });
  }

  async function createUpload(input: { filename: string; mimeType: string; sizeBytes: number }): Promise<string> {
    const result = await call({
      name: McpToolName.CreateUpload,
      arguments: { filename: input.filename, mime_type: input.mimeType, size_bytes: input.sizeBytes },
    });
    return String(result.structuredContent?.upload_id);
  }

  async function uploadReceived(input: { filename: string; mimeType: string; sizeBytes: number }): Promise<string> {
    const uploadId = await createUpload(input);
    await receiveUpload({ accountId: ACCOUNT_ID, uploadId, sizeBytes: input.sizeBytes, mimeType: input.mimeType });
    return uploadId;
  }

  afterEach(async () => {
    await Promise.allSettled(inFlightCalls.splice(0));
    await reset();
  });

  beforeEach(async () => {
    await applyDirectoryMigration();
    const connection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: AGENT });
    client = await connectClient({ secret: connection.secret });
    await openWindow({ client, accountId: ACCOUNT_ID });
  });

  it('lists exactly the registered tools in definition order', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(Object.keys(TOOL_DEFINITIONS));
  });

  it('sends a text message and shows it on the owner screen', async () => {
    const result = await sendText('oi');
    expect(result.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
    expect(result.structuredContent?.message_id).toBeTruthy();
    const messagesResult = await call({ name: McpToolName.GetMessages, arguments: {} });
    const history = messagesResult.structuredContent?.history as { text: string | null }[];
    expect(history.map((message) => message.text)).toContain('oi');
  });

  it('rejects text over the limit naming the field', async () => {
    const result = await sendText('a'.repeat(TEXT_OVER_LIMIT));
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('text: must be at most 4096 characters');
  });

  it('rejects an unknown reply target', async () => {
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: 'oi', reply_to: 'msg_missing' } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('reply_to: message not found');
  });

  it('sends an image by https link', async () => {
    const result = await call({ name: McpToolName.SendMedia, arguments: { kind: MessageKind.Image, url: 'https://example.com/a.jpg' } });
    expect(result.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
  });

  it.each([
    { kind: MessageKind.Video, mimeType: 'video/mp4', sizeBytes: 1000, voice: false },
    { kind: MessageKind.Audio, mimeType: 'audio/ogg', sizeBytes: 1000, voice: true },
    { kind: MessageKind.Document, mimeType: 'application/pdf', sizeBytes: 1000, voice: false },
    { kind: MessageKind.Sticker, mimeType: 'image/webp', sizeBytes: STICKER_LIMIT_BYTES, voice: false },
  ])('sends $kind by upload', async ({ kind, mimeType, sizeBytes, voice }) => {
    const uploadId = await uploadReceived({ filename: 'file', mimeType, sizeBytes });
    const result = await call({ name: McpToolName.SendMedia, arguments: { kind, upload_id: uploadId, voice } });
    expect(result.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
  });

  it('rejects a sticker over the limit naming size_bytes', async () => {
    const uploadId = await uploadReceived({ filename: 's.webp', mimeType: 'image/webp', sizeBytes: STICKER_LIMIT_BYTES + 1 });
    const result = await call({ name: McpToolName.SendMedia, arguments: { kind: MessageKind.Sticker, upload_id: uploadId } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('size_bytes');
  });

  it('rejects a plain http link', async () => {
    const result = await call({ name: McpToolName.SendMedia, arguments: { kind: MessageKind.Image, url: 'http://example.com/a.jpg' } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('url: must be an https URL');
  });

  it.each([
    { name: 'both url and upload_id', arguments: { kind: MessageKind.Image, url: 'https://example.com/a.jpg', upload_id: 'med_1' } },
    { name: 'neither', arguments: { kind: MessageKind.Image } },
  ])('requires exactly one source: $name', async ({ arguments: toolArguments }) => {
    const result = await call({ name: McpToolName.SendMedia, arguments: toolArguments });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('exactly one of url and upload_id is required');
  });

  it('rejects an upload that was never received', async () => {
    const uploadId = await createUpload({ filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1000 });
    const result = await call({ name: McpToolName.SendMedia, arguments: { kind: MessageKind.Document, upload_id: uploadId } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('upload_id: bytes not uploaded yet');
  });

  it('rejects a kind that does not match the upload type', async () => {
    const uploadId = await uploadReceived({ filename: 'v.mp4', mimeType: 'video/mp4', sizeBytes: 1000 });
    const result = await call({ name: McpToolName.SendMedia, arguments: { kind: MessageKind.Image, upload_id: uploadId } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('mime_type');
  });

  it('sends a location and rejects a latitude out of range', async () => {
    const sent = await call({ name: McpToolName.SendLocation, arguments: { latitude: -23.5, longitude: -46.6 } });
    expect(sent.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
    const rejected = await call({
      name: McpToolName.SendLocation,
      arguments: { latitude: LOCATION_LATITUDE_OUT_OF_RANGE, longitude: 0 },
    });
    expect(rejected.isError).toBe(true);
    expect(rejected.content[0]?.text).toContain('latitude');
  });

  it('sends contacts and rejects eleven cards', async () => {
    const card = { name: 'Maria', phones: ['+5511999990000'] };
    const sent = await call({ name: McpToolName.SendContact, arguments: { contacts: [card] } });
    expect(sent.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
    const rejected = await call({
      name: McpToolName.SendContact,
      arguments: { contacts: Array.from({ length: CONTACT_CARDS_OVER_LIMIT }, () => card) },
    });
    expect(rejected.isError).toBe(true);
    expect(rejected.content[0]?.text).toContain('contacts');
  });

  it('clears a reaction with an empty emoji', async () => {
    await sendText('hi');
    const ownerMessageId = await ownerWrites({
      accountId: ACCOUNT_ID,
      channelMessageId: 'wamid.react',
      content: ownerText({ text: 'oi' }),
    });
    const result = await call({ name: McpToolName.React, arguments: { message_id: ownerMessageId, emoji: '' } });
    expect(result.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
    const messagesResult = await call({ name: McpToolName.GetMessages, arguments: {} });
    const history = messagesResult.structuredContent?.history as { kind: MessageKind; emoji: string | null }[];
    expect(history.find((message) => message.kind === MessageKind.Reaction)?.emoji).toBeNull();
  });

  it('rejects two emoji', async () => {
    await sendText('hi');
    const ownerMessageId = await ownerWrites({
      accountId: ACCOUNT_ID,
      channelMessageId: 'wamid.react2',
      content: ownerText({ text: 'oi' }),
    });
    const result = await call({ name: McpToolName.React, arguments: { message_id: ownerMessageId, emoji: '👍👍' } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('emoji');
  });

  it.each([
    {
      name: 'list row over the limit',
      options: ['a'.repeat(LIST_OPTION_OVER_LIMIT), 'b', 'c', 'd'],
      message: 'options[0]: list row title must be at most 24 characters',
    },
    {
      name: 'button title over the limit',
      options: ['a'.repeat(BUTTON_OPTION_OVER_LIMIT), 'b', 'c'],
      message: 'options[0]: button title must be at most 20 characters',
    },
  ])('rejects an ask with a $name', async ({ options, message }) => {
    const result = await call({
      name: McpToolName.Ask,
      arguments: { question: 'Qual?', options: options.map((title) => ({ title })) },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(message);
  });

  it('rejects an ask above the wait ceiling', async () => {
    const result = await call({
      name: McpToolName.Ask,
      arguments: { question: 'Qual?', options: [{ title: 'sim' }], timeout_seconds: TIMEOUT_OVER_LIMIT_SECONDS },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('timeout_seconds');
  });

  async function heldQuestionId(): Promise<string> {
    return vi.waitFor(async () => {
      const messagesResult = await call({ name: McpToolName.GetMessages, arguments: {} });
      const history = messagesResult.structuredContent?.history as { kind: MessageKind; choice: { question_id: string } | null }[];
      const question = history.find((message) => message.kind === MessageKind.Choice);
      if (!question?.choice) throw new Error('question not stored yet');
      return question.choice.question_id;
    }, HELD_QUESTION_WAIT_MS);
  }

  it('WI-56 returns the owner tap on a held ask', async () => {
    const asking = call({ name: McpToolName.Ask, arguments: { question: 'Qual?', options: [{ title: 'sim' }] } });
    const questionId = await heldQuestionId();
    await ownerWrites({
      accountId: ACCOUNT_ID,
      channelMessageId: 'wamid.tap',
      content: {
        kind: MessageKind.Choice,
        optionId: formatOptionId({ questionId, optionIndex: 0 }),
        optionTitle: 'sim',
        optionDescription: null,
      },
    });
    const result = await asking;
    expect(result.structuredContent).toMatchObject({ status: ReplyStatus.Answered, answer: 'sim' });
  });

  it('answers get_messages on the same client while an ask is held', async () => {
    const asking = call({
      name: McpToolName.Ask,
      arguments: { question: 'Qual?', options: [{ title: 'sim' }], timeout_seconds: HELD_ASK_SECONDS },
    });
    await heldQuestionId();
    const deadline = new Promise<string>((resolve) => setTimeout(() => resolve(CONCURRENT_CALL_TIMED_OUT), CONCURRENT_CALL_DEADLINE_MS));
    const concurrent = call({ name: McpToolName.GetMessages, arguments: {} });
    expect(await Promise.race([concurrent, deadline])).not.toBe(CONCURRENT_CALL_TIMED_OUT);
    const questionId = await heldQuestionId();
    await ownerWrites({
      accountId: ACCOUNT_ID,
      channelMessageId: 'wamid.release',
      content: {
        kind: MessageKind.Choice,
        optionId: formatOptionId({ questionId, optionIndex: 0 }),
        optionTitle: 'sim',
        optionDescription: null,
      },
    });
    expect((await asking).structuredContent).toMatchObject({ status: ReplyStatus.Answered });
  });

  it('returns a pending question when the wait times out', async () => {
    const result = await call({
      name: McpToolName.Ask,
      arguments: { question: 'Qual?', options: [{ title: 'sim' }], timeout_seconds: SHORT_WAIT_SECONDS },
    });
    expect(result.structuredContent).toMatchObject({ status: ReplyStatus.Pending, answer: null });
    expect(result.structuredContent?.question_id).toBeTruthy();
  });

  it('rejects wait_for_reply for an unknown question', async () => {
    const result = await call({ name: McpToolName.WaitForReply, arguments: { question_id: 'qst_missing' } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('question_id: question not found');
  });

  it('returns the owner text from wait_for_reply without a question', async () => {
    await sendText('hi');
    const waiting = call({ name: McpToolName.WaitForReply, arguments: {} });
    await ownerWrites({ accountId: ACCOUNT_ID, channelMessageId: 'wamid.wait', content: ownerText({ text: 'oi' }) });
    const result = await waiting;
    const messages = result.structuredContent?.messages as { text: string; sender: string; verified: boolean }[];
    expect(result.structuredContent?.status).toBe(ReplyStatus.Message);
    expect(messages[0]).toMatchObject({ text: 'oi', sender: 'owner', verified: true });
  });

  it('times out wait_for_reply when nothing arrives', async () => {
    const result = await call({ name: McpToolName.WaitForReply, arguments: { timeout_seconds: SHORT_WAIT_SECONDS } });
    expect(result.structuredContent).toMatchObject({ status: ReplyStatus.Timeout });
  });

  it('bounds get_messages by the history limit', async () => {
    await sendText('hi');
    await Promise.all(
      Array.from({ length: UNREAD_COUNT }, (_, index) =>
        ownerWrites({ accountId: ACCOUNT_ID, channelMessageId: `wamid.bulk${index}`, content: ownerText({ text: `m${index}` }) }),
      ),
    );
    const result = await call({ name: McpToolName.GetMessages, arguments: {} });
    expect(result.structuredContent?.unread).toHaveLength(HISTORY_LIMIT);
  });

  it('returns an empty check_inbox immediately', async () => {
    const result = await call({ name: McpToolName.CheckInbox, arguments: {} });
    expect(result.structuredContent).toMatchObject({ status: InboxStatus.Empty, messages: [] });
  });

  it('returns new messages once from check_inbox', async () => {
    await sendText('hi');
    await ownerWrites({ accountId: ACCOUNT_ID, channelMessageId: 'wamid.check', content: ownerText({ text: 'oi' }) });
    const first = await call({ name: McpToolName.CheckInbox, arguments: {} });
    const second = await call({ name: McpToolName.CheckInbox, arguments: {} });
    expect(first.structuredContent).toMatchObject({ status: InboxStatus.New });
    expect(first.structuredContent?.messages).toHaveLength(1);
    expect(second.structuredContent).toMatchObject({ status: InboxStatus.Empty });
  });

  it('creates an upload with a signed link and an ISO expiry', async () => {
    const result = await call({
      name: McpToolName.CreateUpload,
      arguments: { filename: 'a.pdf', mime_type: 'application/pdf', size_bytes: 1000 },
    });
    const uploadUrl = String(result.structuredContent?.upload_url);
    expect(result.structuredContent?.upload_id).toBeTruthy();
    expect(uploadUrl).toContain(`/u/${ACCOUNT_ID}/${result.structuredContent?.upload_id}`);
    expect(JSON.stringify(result)).not.toContain(CONNECTION_SECRET_PREFIX);
    expect(uploadUrl).toContain('exp=');
    expect(uploadUrl).toContain('sig=');
    expect(String(result.structuredContent?.expires_at)).toMatch(ISO_TIMESTAMP_PATTERN);
    expect(Date.parse(String(result.structuredContent?.expires_at))).toBeGreaterThan(Date.now());
  });

  it.each([
    { name: 'an empty type', arguments: { filename: 'a', mime_type: '', size_bytes: 1000 }, field: 'mime_type' },
    {
      name: 'a size over the document limit',
      arguments: { filename: 'a', mime_type: 'application/pdf', size_bytes: DOCUMENT_OVER_LIMIT_BYTES },
      field: 'size_bytes',
    },
  ])('rejects create_upload with $name', async ({ arguments: toolArguments, field }) => {
    const result = await call({ name: McpToolName.CreateUpload, arguments: toolArguments });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(field);
  });

  it('renders every timestamp as ISO 8601 and keeps a null contact organization', async () => {
    await sendText('hi');
    await ownerWrites({ accountId: ACCOUNT_ID, channelMessageId: 'wamid.text', content: ownerText({ text: 'oi' }) });
    await ownerWrites({
      accountId: ACCOUNT_ID,
      channelMessageId: 'wamid.contact',
      content: { kind: MessageKind.Contacts, contacts: [{ name: 'Maria', phones: ['+5511999990000'], emails: [], organization: null }] },
    });
    const result = await call({ name: McpToolName.CheckInbox, arguments: {} });
    const messages = (result.structuredContent?.messages as unknown[]).map((message) => messageWireSchema.parse(message));
    expect(messages.map((message) => message.at).every((at) => ISO_TIMESTAMP_PATTERN.test(at))).toBe(true);
    expect(messages.find((message) => message.kind === MessageKind.Contacts)?.contacts?.[0]?.organization).toBeNull();
  });
});
