import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { INLINE_IMAGE_MAX_BYTES, NOTICE_QUICK_REPLY_ID, WINDOW_MS } from '@zapbip/core';
import { InboxStatus, MessageKind, ReplyStatus, SECOND_MS } from '@zapbip/types';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { McpToolName, TOOL_DEFINITIONS } from '../../src/contract/tool-definitions';
import {
  advanceClock,
  callTool,
  type ToolResult,
  connectAgent,
  mcpUrl,
  postOwner,
  postOwnerText,
  readScreen,
  secretOf,
  stack,
} from './stack';

const FIRST_AGENT = 'alpha';
const SECOND_AGENT = 'beta';
const TEXT_LIMIT = 4096;
const SHORT_WAIT_SECONDS = 1;
const TAP_DELAY_MS = SECOND_MS;
const HELD_CALL_TIMEOUT_MS = 55 * SECOND_MS;
const SMALL_IMAGE_BYTES = 100_000;
const OVERSIZED_IMAGE_BYTES = INLINE_IMAGE_MAX_BYTES + 100_000;
const PNG_TYPE = 'image/png';
const STICKER_BYTES = 100_000;
const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const MEDIA_LINK_PATTERN = /https?:\/\/\S+\/m\/\S+/;
const YES_TITLE = 'Sim';
const NO_TITLE = 'Não';

let alpha: Client;
let beta: Client;

function base64Of(input: { length: number }): string {
  return Buffer.alloc(input.length, 1).toString('base64');
}

async function drain(input: { client: Client }): Promise<void> {
  await callTool({ client: input.client, name: McpToolName.CheckInbox, arguments: {} });
}

async function sendText(input: { client: Client; text: string }) {
  return callTool({ client: input.client, name: McpToolName.SendMessage, arguments: { text: input.text } });
}

async function tapOption(input: { optionIndex: number; title: string }): Promise<void> {
  const entries = await readScreen();
  const prompt = entries.filter((entry) => entry.options.length > 0).at(-1);
  if (!prompt) throw new Error('no prompt on the screen');
  const optionId = prompt.options[input.optionIndex];
  if (!optionId) throw new Error('option missing on the prompt');
  await postOwner({ body: { kind: MessageKind.Choice, option_id: optionId, title: input.title } });
}

function listOf(input: { result: ToolResult; key: string }): Record<string, unknown>[] {
  if (!input.result.structured) throw new Error(`tool answered without structured content: ${input.result.text}`);
  return input.result.structured[input.key] as Record<string, unknown>[];
}

beforeAll(async () => {
  alpha = await connectAgent({ agent: FIRST_AGENT });
  beta = await connectAgent({ agent: SECOND_AGENT });
});

afterAll(async () => {
  await Promise.all([alpha.close(), beta.close()]);
});

describe('MCP client against wrangler dev', () => {
  test('E2E-1 tools/list names every registered tool with its schemas', async () => {
    const { tools } = await alpha.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(TOOL_DEFINITIONS).sort());
    expect(tools.every((tool) => tool.inputSchema && tool.outputSchema)).toBe(true);
  });

  test('E2E-22 an unknown secret is refused by the transport', async () => {
    const client = new Client({ name: 'zapbip-e2e', version: '0.0.0' });
    await expect(client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl({ secret: UNKNOWN_SECRET }))))).rejects.toThrow();
  });

  test('E2E-23 the Bearer header on /mcp lists the same tools', async () => {
    const client = new Client({ name: 'zapbip-e2e', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${stack().origin}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${secretOf({ agent: FIRST_AGENT })}` } },
      }),
    );
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(TOOL_DEFINITIONS).sort());
  });

  test('E2E-19 E2E-20 owner text with no route opens one list and both messages follow the tap', async () => {
    await Promise.all([drain({ client: alpha }), drain({ client: beta })]);
    await postOwnerText({ text: 'oi', replyTo: null });
    await postOwnerText({ text: 'segunda', replyTo: null });
    const lists = (await readScreen()).filter((entry) => entry.options.some((option) => option.endsWith(':alpha')));
    expect(lists).toHaveLength(1);
    const betaOption = lists[0]?.options.find((option) => option.endsWith(`:${SECOND_AGENT}`));
    expect(betaOption).toBeDefined();
    await postOwner({ body: { kind: MessageKind.Choice, option_id: betaOption, title: SECOND_AGENT } });
    const inbox = await callTool({ client: beta, name: McpToolName.CheckInbox, arguments: {} });
    const texts = listOf({ result: inbox, key: 'messages' }).map((message) => message.text);
    expect(texts).toEqual(['oi', 'segunda']);
  });

  test('E2E-2 E2E-3 E2E-4 text with emoji, at the limit and over it', async () => {
    const emoji = await sendText({ client: alpha, text: 'olá 👋' });
    const atLimit = await sendText({ client: alpha, text: 'a'.repeat(TEXT_LIMIT) });
    const screenBefore = await readScreen();
    const overLimit = await sendText({ client: alpha, text: 'segredo'.repeat(TEXT_LIMIT) });
    expect(emoji.structured).toMatchObject({ delivery: 'sent' });
    expect(atLimit.structured).toMatchObject({ delivery: 'sent' });
    expect(overLimit.isError).toBe(true);
    expect(overLimit.text).toContain('text');
    expect(overLimit.text).not.toContain('segredo');
    expect(await readScreen()).toHaveLength(screenBefore.length);
    expect(screenBefore.some((entry) => entry.text.includes('olá 👋'))).toBe(true);
  });

  test('E2E-5 the upload cycle ends in a link that returns the same bytes', async () => {
    const bytes = Buffer.alloc(1024, 7);
    const upload = await callTool({
      client: alpha,
      name: McpToolName.CreateUpload,
      arguments: { filename: 'a.png', mime_type: PNG_TYPE, size_bytes: bytes.byteLength },
    });
    const put = await fetch(String(upload.structured?.upload_url), {
      method: 'PUT',
      headers: { 'Content-Type': PNG_TYPE, 'Content-Length': String(bytes.byteLength) },
      body: bytes,
    });
    const sent = await callTool({
      client: alpha,
      name: McpToolName.SendMedia,
      arguments: { kind: MessageKind.Image, upload_id: upload.structured?.upload_id },
    });
    const link = (await readScreen()).map((entry) => MEDIA_LINK_PATTERN.exec(entry.text)?.[0]).findLast((found) => found !== undefined);
    expect(put.status).toBe(201);
    expect(sent.structured).toMatchObject({ delivery: 'sent' });
    expect(link).toBeDefined();
    const downloaded = await fetch(String(link));
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes);
  });

  test('E2E-6 a link image reaches the screen with its link', async () => {
    const link = 'https://example.com/a.jpg';
    const sent = await callTool({ client: alpha, name: McpToolName.SendMedia, arguments: { kind: MessageKind.Image, url: link } });
    expect(sent.structured).toMatchObject({ delivery: 'sent' });
    expect((await readScreen()).some((entry) => entry.text.includes(link))).toBe(true);
  });

  test('E2E-8 location, contact and reaction are sent', async () => {
    const owner = await postOwnerText({ text: 'reaja', replyTo: null });
    const location = await callTool({ client: alpha, name: McpToolName.SendLocation, arguments: { latitude: -23.5, longitude: -46.6 } });
    const contact = await callTool({
      client: alpha,
      name: McpToolName.SendContact,
      arguments: { contacts: [{ name: 'Maria', phones: ['5511999990001'] }] },
    });
    const reaction = await callTool({ client: alpha, name: McpToolName.React, arguments: { message_id: owner.message_id, emoji: '👍' } });
    expect([location, contact, reaction].map((result) => result.structured?.delivery)).toEqual(['sent', 'sent', 'sent']);
    await drain({ client: alpha });
  });

  test(
    'E2E-9 ask is answered by a tap during the hold',
    async () => {
      const held = callTool({
        client: alpha,
        name: McpToolName.Ask,
        arguments: { question: 'Vamos?', options: [{ title: YES_TITLE }, { title: NO_TITLE }] },
      });
      await delay(TAP_DELAY_MS);
      await tapOption({ optionIndex: 1, title: NO_TITLE });
      const answer = await held;
      expect(answer.structured).toMatchObject({ status: ReplyStatus.Answered, answer: NO_TITLE });
    },
    HELD_CALL_TIMEOUT_MS,
  );

  test('E2E-10 ask pending then answered, the same answer twice', async () => {
    const pending = await callTool({
      client: alpha,
      name: McpToolName.Ask,
      arguments: { question: 'Vamos de novo?', options: [{ title: YES_TITLE }, { title: NO_TITLE }], timeout_seconds: SHORT_WAIT_SECONDS },
    });
    expect(pending.structured).toMatchObject({ status: ReplyStatus.Pending });
    await tapOption({ optionIndex: 0, title: YES_TITLE });
    const questionId = pending.structured?.question_id;
    const first = await callTool({ client: alpha, name: McpToolName.WaitForReply, arguments: { question_id: questionId } });
    const second = await callTool({ client: alpha, name: McpToolName.WaitForReply, arguments: { question_id: questionId } });
    expect(first.structured).toMatchObject({ status: ReplyStatus.Answered, answer: YES_TITLE });
    expect(second.structured).toMatchObject({ status: ReplyStatus.Answered, answer: YES_TITLE });
  });

  test('E2E-11 owner text reaches check_inbox once', async () => {
    await postOwnerText({ text: 'olá', replyTo: null });
    const first = await callTool({ client: alpha, name: McpToolName.CheckInbox, arguments: {} });
    const second = await callTool({ client: alpha, name: McpToolName.CheckInbox, arguments: {} });
    expect(first.structured).toMatchObject({ status: InboxStatus.New, messages: [{ text: 'olá', sender: 'owner', verified: true }] });
    expect(second.structured).toMatchObject({ status: InboxStatus.Empty, messages: [] });
  });

  test('E2E-12 get_messages marks read', async () => {
    await postOwnerText({ text: 'lida', replyTo: null });
    const first = await callTool({ client: alpha, name: McpToolName.GetMessages, arguments: {} });
    const second = await callTool({ client: alpha, name: McpToolName.GetMessages, arguments: {} });
    expect(listOf({ result: first, key: 'unread' })).toMatchObject([{ text: 'lida' }]);
    expect(listOf({ result: second, key: 'unread' })).toEqual([]);
    expect(second.structured?.history).toEqual(expect.arrayContaining([expect.objectContaining({ text: 'lida' })]));
  });

  test(
    'E2E-13 wait_for_reply returns text sent during the hold',
    async () => {
      const held = callTool({ client: alpha, name: McpToolName.WaitForReply, arguments: {} });
      await delay(TAP_DELAY_MS);
      await postOwnerText({ text: 'sim', replyTo: null });
      const reply = await held;
      expect(reply.structured).toMatchObject({ status: ReplyStatus.Message, messages: [{ text: 'sim' }] });
    },
    HELD_CALL_TIMEOUT_MS,
  );

  test.each([
    { label: 'E2E-14 within the inline limit', bytes: SMALL_IMAGE_BYTES, hasInlineBlock: true },
    { label: 'E2E-15 over the inline limit', bytes: OVERSIZED_IMAGE_BYTES, hasInlineBlock: false },
  ])('$label an inbound image has a link and the right inline block', async ({ bytes, hasInlineBlock }) => {
    await postOwner({ body: { kind: MessageKind.Image, mime_type: PNG_TYPE, data_base64: base64Of({ length: bytes }) } });
    const messages = await callTool({ client: alpha, name: McpToolName.GetMessages, arguments: {} });
    const [image] = listOf({ result: messages, key: 'unread' });
    expect(image).toMatchObject({ kind: MessageKind.Image });
    expect(messages.blockTypes.includes('image')).toBe(hasInlineBlock);
    const downloaded = await fetch(String(image?.url));
    expect(downloaded.status).toBe(200);
  });

  test('E2E-16 inbound video, document, sticker and voice note are listed with their kind', async () => {
    const samples = [
      { kind: MessageKind.Video, mime_type: 'video/mp4', voice: false },
      { kind: MessageKind.Document, mime_type: 'application/pdf', voice: false },
      { kind: MessageKind.Sticker, mime_type: 'image/webp', voice: false },
      { kind: MessageKind.Audio, mime_type: 'audio/ogg', voice: true },
    ];
    await Promise.all(samples.map((sample) => postOwner({ body: { ...sample, data_base64: base64Of({ length: STICKER_BYTES / 100 }) } })));
    const messages = await callTool({ client: alpha, name: McpToolName.GetMessages, arguments: {} });
    expect(
      listOf({ result: messages, key: 'unread' })
        .map((message) => message.kind)
        .sort(),
    ).toEqual(samples.map((sample) => sample.kind).sort());
    expect(listOf({ result: messages, key: 'unread' }).every((message) => typeof message.media_id === 'string')).toBe(true);
  });

  test('E2E-17 a quoted reply goes to the agent that wrote the quoted message', async () => {
    await Promise.all([drain({ client: alpha }), drain({ client: beta })]);
    const quoted = await sendText({ client: beta, text: 'pergunta do beta' });
    await sendText({ client: alpha, text: 'pergunta do alpha' });
    await postOwnerText({ text: 'resposta citada', replyTo: String(quoted.structured?.message_id) });
    const betaInbox = await callTool({ client: beta, name: McpToolName.CheckInbox, arguments: {} });
    const alphaInbox = await callTool({ client: alpha, name: McpToolName.CheckInbox, arguments: {} });
    expect(betaInbox.structured).toMatchObject({ status: InboxStatus.New, messages: [{ text: 'resposta citada' }] });
    expect(alphaInbox.structured).toMatchObject({ status: InboxStatus.Empty });
  });

  test(
    'E2E-18 owner text goes to the agent with the open question',
    async () => {
      await sendText({ client: beta, text: 'beta fala por ultimo' });
      const held = callTool({
        client: alpha,
        name: McpToolName.Ask,
        arguments: { question: 'Posso?', options: [{ title: YES_TITLE }, { title: NO_TITLE }, { title: 'Talvez' }, { title: 'Nunca' }] },
      });
      await delay(TAP_DELAY_MS);
      await postOwnerText({ text: 'pode', replyTo: null });
      const answer = await held;
      const betaInbox = await callTool({ client: beta, name: McpToolName.CheckInbox, arguments: {} });
      expect(answer.structured).toMatchObject({ status: ReplyStatus.Answered, answer: 'pode' });
      expect(betaInbox.structured).toMatchObject({ status: InboxStatus.Empty });
    },
    HELD_CALL_TIMEOUT_MS,
  );

  test('E2E-21 a closed window queues sends, one notice, and the quick reply flushes them in order', async () => {
    await sendText({ client: alpha, text: 'reabre a janela' });
    await advanceClock({ advanceMs: WINDOW_MS });
    const noticesBefore = (await readScreen()).filter((entry) => entry.template !== null).length;
    const first = await sendText({ client: alpha, text: 'fila-a' });
    const second = await sendText({ client: alpha, text: 'fila-b' });
    const noticesAfter = (await readScreen()).filter((entry) => entry.template !== null).length;
    expect([first, second].map((result) => result.structured?.delivery)).toEqual(['queued', 'queued']);
    expect(noticesAfter - noticesBefore).toBe(1);
    await postOwner({ body: { kind: MessageKind.Choice, option_id: NOTICE_QUICK_REPLY_ID, title: 'Abrir' } });
    const texts = (await readScreen()).map((entry) => entry.text);
    expect(texts.indexOf('fila-a')).toBeGreaterThan(-1);
    expect(texts.indexOf('fila-b')).toBeGreaterThan(texts.indexOf('fila-a'));
    const inbox = await callTool({ client: alpha, name: McpToolName.CheckInbox, arguments: {} });
    expect(inbox.structured).toMatchObject({ status: InboxStatus.Empty });
  });

  test('SEC-7 no connection secret appears in the wrangler output', async () => {
    const output = await readFile(stack().logFile, 'utf8');
    const leaked = Object.values(stack().secrets).filter((secret) => output.includes(secret));
    expect(leaked).toEqual([]);
  });
});
