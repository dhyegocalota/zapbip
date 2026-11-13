import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  ApprovalChoice,
  approvalTitlesOf,
  formatRouteOptionId,
  INLINE_IMAGE_MAX_BYTES,
  NOTICE_QUICK_REPLY_ID,
  renderCopy,
  STICKER_MAX_BYTES,
  WINDOW_MS,
} from '@zapbip/core';
import { AgentChangeStatus, InboxCopyKey, InboxStatus, MessageKind, OwnerLocale, ReplyStatus, SECOND_MS } from '@zapbip/types';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { McpToolName, TOOL_DEFINITIONS } from '../../src/contract/tool-definitions';
import {
  advanceClock,
  callTool,
  historyOf,
  lastQuestion,
  tapLastQuestion,
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
const STICKER_BYTES = STICKER_MAX_BYTES;
const UPLOAD_BYTES = 2048;
const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const YES_TITLE = 'Sim';
const NO_TITLE = 'Não';
const JSON_LINE_PREFIX = '{';
const NEW_AGENT = 'helper';
const APPROVAL_WAIT_MS = 10 * SECOND_MS;
const INSTALL_LINK_MARKER = '/i/zb_inst_';
const ALLOW_OPTION_INDEX = 0;
const REVOKE_DENY_OPTION_INDEX = 1;

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

async function uploadAndSend(input: { mimeType: string; sizeBytes: number; kindArguments: Record<string, unknown> }): Promise<ToolResult> {
  const bytes = Buffer.alloc(input.sizeBytes, 1);
  const upload = await callTool({
    client: alpha,
    name: McpToolName.CreateUpload,
    arguments: { filename: 'file.bin', mime_type: input.mimeType, size_bytes: bytes.byteLength },
  });
  const put = await fetch(String(upload.structured?.upload_url), {
    method: 'PUT',
    headers: { 'Content-Type': input.mimeType, 'Content-Length': String(bytes.byteLength) },
    body: bytes,
  });
  expect(put.status).toBe(201);
  return callTool({
    client: alpha,
    name: McpToolName.SendMedia,
    arguments: { ...input.kindArguments, upload_id: upload.structured?.upload_id },
  });
}

async function openWindow(): Promise<void> {
  await postOwner({ body: { kind: MessageKind.Choice, option_id: NOTICE_QUICK_REPLY_ID, title: 'Abrir' } });
}

async function heldApproval(input: { client: Client }): Promise<void> {
  const allowTitle = approvalTitlesOf({ locale: OwnerLocale.PortugueseBrazil })[ApprovalChoice.Allow];
  await vi.waitFor(async () => {
    const question = await lastQuestion({ client: input.client });
    if (question === null || question.options[0]?.title !== allowTitle) throw new Error('the approval question is not on the screen yet');
  }, APPROVAL_WAIT_MS);
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
    const held = await postOwnerText({ text: 'oi', replyTo: null });
    await postOwnerText({ text: 'segunda', replyTo: null });
    const reminderText = renderCopy({ key: InboxCopyKey.RoutingListReminder, locale: OwnerLocale.PortugueseBrazil, values: {} });
    const remindersAfterSecond = (await readScreen()).filter((entry) => entry.text === reminderText);
    await postOwnerText({ text: 'terceira', replyTo: null });
    const remindersAfterThird = (await readScreen()).filter((entry) => entry.text === reminderText);
    expect(remindersAfterSecond).toHaveLength(1);
    expect(remindersAfterThird).toHaveLength(1);
    const lists = (await readScreen()).filter((entry) => entry.options.includes(FIRST_AGENT) && entry.options.includes(SECOND_AGENT));
    expect(lists).toHaveLength(1);
    expect(held.message_id).not.toBeNull();
    const betaOption = formatRouteOptionId({ messageId: String(held.message_id), agent: SECOND_AGENT });
    await postOwner({ body: { kind: MessageKind.Choice, option_id: betaOption, title: SECOND_AGENT } });
    const inbox = await callTool({ client: beta, name: McpToolName.CheckInbox, arguments: {} });
    const texts = listOf({ result: inbox, key: 'messages' }).map((message) => message.text);
    expect(texts).toEqual(['oi', 'segunda', 'terceira']);
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
    const link = (await historyOf({ client: alpha })).findLast((message) => message.kind === MessageKind.Image)?.url;
    expect(put.status).toBe(201);
    expect(sent.structured).toMatchObject({ delivery: 'sent' });
    expect(link).toBeDefined();
    expect((await readScreen()).at(-1)?.text).toMatch(new RegExp(`^\\[imagem\\] ${String(link).split('?')[0]}\\?exp=\\d+&sig=`));
    const downloaded = await fetch(String(link));
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes);
  });

  test('E2E-6 a link image reaches the screen with its link', async () => {
    const link = 'https://example.com/a.jpg';
    const sent = await callTool({ client: alpha, name: McpToolName.SendMedia, arguments: { kind: MessageKind.Image, url: link } });
    expect(sent.structured).toMatchObject({ delivery: 'sent' });
    const history = await historyOf({ client: alpha });
    expect(history.findLast((message) => message.kind === MessageKind.Image)?.url).toBe(link);
  });

  test.each([
    { label: 'video', mimeType: 'video/mp4', arguments: { kind: MessageKind.Video }, placeholder: '[vídeo]' },
    { label: 'voice note', mimeType: 'audio/ogg', arguments: { kind: MessageKind.Audio, voice: true }, placeholder: '[mensagem de voz]' },
    { label: 'document', mimeType: 'application/pdf', arguments: { kind: MessageKind.Document }, placeholder: '[documento]' },
    { label: 'sticker', mimeType: 'image/webp', arguments: { kind: MessageKind.Sticker }, placeholder: '[figurinha]' },
  ])(
    'E2E-7 an uploaded $label reaches the screen with its placeholder and link',
    async ({ mimeType, arguments: kindArguments, placeholder }) => {
      const sizeBytes = kindArguments.kind === MessageKind.Sticker ? STICKER_BYTES : UPLOAD_BYTES;
      const sent = await uploadAndSend({ mimeType, sizeBytes, kindArguments });
      const link = (await historyOf({ client: alpha })).findLast((message) => message.kind === kindArguments.kind)?.url;
      expect(sent.structured).toMatchObject({ delivery: 'sent' });
      expect(link).toBeDefined();
      expect((await readScreen()).at(-1)?.text.split('?')[0]).toBe(`${placeholder} ${String(link).split('?')[0]}`);
    },
  );

  test('E2E-7 a sticker of 100,001 bytes is refused and nothing reaches the screen', async () => {
    const screenBefore = await readScreen();
    const sent = await uploadAndSend({
      mimeType: 'image/webp',
      sizeBytes: STICKER_BYTES + 1,
      kindArguments: { kind: MessageKind.Sticker },
    });
    expect(sent.isError).toBe(true);
    expect(await readScreen()).toHaveLength(screenBefore.length);
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
      await tapLastQuestion({ client: alpha, optionIndex: 1 });
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
    await tapLastQuestion({ client: alpha, optionIndex: 0 });
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
    const positionOf = (needle: string) => texts.findIndex((text) => text.includes(needle));
    expect(positionOf('fila-a')).toBeGreaterThan(-1);
    expect(positionOf('fila-b')).toBeGreaterThan(positionOf('fila-a'));
    const inbox = await callTool({ client: alpha, name: McpToolName.CheckInbox, arguments: {} });
    expect(inbox.structured).toMatchObject({ status: InboxStatus.Empty });
  });

  test(
    'E2E-24 connect_agent asks on the screen, an Allow tap connects the agent and the install link reaches the owner, not the result',
    async () => {
      await openWindow();
      const held = callTool({ client: alpha, name: McpToolName.ConnectAgent, arguments: { name: NEW_AGENT } });
      await heldApproval({ client: alpha });
      const question = await lastQuestion({ client: alpha });
      const titles = approvalTitlesOf({ locale: OwnerLocale.PortugueseBrazil });
      expect(question?.options.map((option) => option.title)).toEqual(
        [ApprovalChoice.Allow, ApprovalChoice.AllowAndSend, ApprovalChoice.Deny].map((choice) => titles[choice]),
      );
      await tapLastQuestion({ client: alpha, optionIndex: ALLOW_OPTION_INDEX });
      const result = await held;
      const listed = await callTool({ client: alpha, name: McpToolName.ListAgents, arguments: {} });
      expect(result.structured).toEqual({ status: AgentChangeStatus.Applied, agent: NEW_AGENT, reason: null, install_prompt: null });
      expect((await readScreen()).some((entry) => entry.text.includes(INSTALL_LINK_MARKER))).toBe(true);
      expect(listOf({ result: listed, key: 'agents' }).map((agent) => agent.name)).toContain(NEW_AGENT);
    },
    HELD_CALL_TIMEOUT_MS,
  );

  test(
    'E2E-25 a Deny tap on revoke_agent leaves the agent connected',
    async () => {
      await openWindow();
      const held = callTool({ client: alpha, name: McpToolName.RevokeAgent, arguments: { name: SECOND_AGENT } });
      await heldApproval({ client: alpha });
      await tapLastQuestion({ client: alpha, optionIndex: REVOKE_DENY_OPTION_INDEX });
      expect((await held).structured).toMatchObject({ status: AgentChangeStatus.Denied, agent: SECOND_AGENT });
      expect((await callTool({ client: beta, name: McpToolName.CheckInbox, arguments: {} })).isError).toBe(false);
    },
    HELD_CALL_TIMEOUT_MS,
  );

  test('SEC-7 no connection secret appears in the worker log lines', async () => {
    const output = await readFile(stack().logFile, 'utf8');
    const workerLines = output.split('\n').filter((line) => line.startsWith(JSON_LINE_PREFIX));
    const leaked = Object.values(stack().secrets).filter((secret) => workerLines.some((line) => line.includes(secret)));
    expect(leaked).toEqual([]);
  });
});
