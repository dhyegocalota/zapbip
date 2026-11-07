import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WINDOW_MS } from '@zapbip/core';
import { DeliveryState, InboxStatus, MediaSourceKind, MessageDirection, MessageKind, ReplyStatus, SECOND_MS } from '@zapbip/types';
import { beforeAll, describe, expect, test } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import audioVoiceFixture from '../fixtures/whatsapp/inbound/audio-voice.json';
import buttonFixture from '../fixtures/whatsapp/inbound/button.json';
import listReplyFixture from '../fixtures/whatsapp/inbound/list-reply.json';
import reactionFixture from '../fixtures/whatsapp/inbound/reaction.json';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import { notificationOf, changeOf } from '../fixtures/whatsapp/inbound/notification';
import readStatusFixture from '../fixtures/whatsapp/status/read.json';
import listFixture from '../fixtures/whatsapp/outbound/list.json';
import templateFixture from '../fixtures/whatsapp/outbound/template-notice-pt_BR.json';
import { advanceClock, callTool, connectAgent, type ToolResult } from './stack';
import { FAKE_GRAPH_PORT, GRAPH_MESSAGES_PATH, OWNER_PHONE, PHONE_NUMBER_ID } from './whatsapp-support/constants';
import { fakeGraph, lastSentWamid, postSignedMessage, postSignedWebhook, sentRequests } from './whatsapp-support/webhook';

const AGENT = 'alpha';
const NEW_AGENT_COMMAND = 'novo agente beta';
const INSTALL_LINK_MARK = '/i/';
const STATUS_OK = 200;
const POLL_TIMEOUT_MS = 10 * SECOND_MS;
const ASK_TIMEOUT_MS = 30 * SECOND_MS;
const ASK_WAIT_SECONDS = 20;
const NO_OFFSET_MS = 0;
const CLOSED_WINDOW_OFFSET_MS = WINDOW_MS + 1;
const GRAPH_MEDIA_PATH = '/v24.0/900000000000004';
const FOREIGN_MEDIA_URL = 'https://media.example.com/voice';
const FAKE_FILE_SIZE_BYTES = 10;
const FAKE_GRAPH_ORIGIN = `http://127.0.0.1:${FAKE_GRAPH_PORT}`;
const VOICE_DOWNLOAD_PATH = '/media/voice';
const VOICE_NOTE_CONTENT = 'voice-note-bytes';
const DIGEST_ALGORITHM = 'SHA-256';
const OWNER_EMOJI = '👍';
const QUESTION_TEXT = 'Qual ambiente?';
const ANSWER_INDEX = 1;
const ANSWER_TITLE = 'Staging';
const TEMPLATE_AGENT_PLACEHOLDER = 'Agente de teste';
const TEMPLATE_PREVIEW_PLACEHOLDER = 'Mensagem de exemplo';
const QUESTION_ID_PLACEHOLDER = 'qst_1';
const QUEUED_TEXT = 'Mensagem fora da janela';
const MEDIA_UNAVAILABLE_NOTICE = 'Não consegui baixar o arquivo. Envie de novo, por favor.';

type WireMessage = {
  message_id: string;
  kind: MessageKind;
  direction: MessageDirection;
  text: string | null;
  emoji: string | null;
  sender: string;
  verified: boolean;
  media_status: string | null;
  url: string | null;
  delivery: DeliveryState | null;
  voice: boolean | null;
  choice: { question_id: string } | null;
};

type InstallReplyBody = { text?: { body: string; preview_url: boolean } };

let agent: Client;
let askAnswer: Promise<ToolResult>;
let askWamid: string;
let questionId: string;

function messagesOf(input: { result: ToolResult; key: string }): WireMessage[] {
  if (!input.result.structured) throw new Error(`tool answered without structured content: ${input.result.text}`);
  return input.result.structured[input.key] as WireMessage[];
}

function checkInbox(): Promise<ToolResult> {
  return callTool({ client: agent, name: McpToolName.CheckInbox, arguments: {} });
}

async function historyOf(): Promise<WireMessage[]> {
  return messagesOf({ result: await callTool({ client: agent, name: McpToolName.GetMessages, arguments: {} }), key: 'history' });
}

function sendText(input: { text: string }): Promise<ToolResult> {
  return callTool({ client: agent, name: McpToolName.SendMessage, arguments: { text: input.text } });
}

function bodyOf(input: { json: object; replacements: [string, string][] }): unknown {
  const text = input.replacements.reduce((current, [from, to]) => current.replaceAll(from, to), JSON.stringify(input.json));
  return JSON.parse(text);
}

function replyOf(input: { optionId: string; contextId: string }): object {
  const { interactive } = listReplyFixture;
  return {
    ...listReplyFixture,
    id: 'wamid.LISTREPLY.E2E',
    context: { ...listReplyFixture.context, id: input.contextId },
    interactive: { ...interactive, list_reply: { ...interactive.list_reply, id: input.optionId } },
  };
}

beforeAll(async () => {
  agent = await connectAgent({ agent: AGENT });
  await sendText({ text: 'pronto' });
});

describe('WhatsApp channel end to end', () => {
  test('E2E-1 a signed owner text reaches check_inbox as a verified owner message', async () => {
    const response = await postSignedMessage({ message: { ...textFixture, id: 'wamid.E2E1' }, offsetMs: NO_OFFSET_MS });
    expect(response.status).toBe(STATUS_OK);
    const inbox = await checkInbox();
    expect(inbox.structured).toMatchObject({ status: InboxStatus.New, messages: [{ text: 'Oi', sender: 'owner', verified: true }] });
  });

  test('Edge: the same signed webhook posted twice reaches check_inbox once', async () => {
    const message = { ...textFixture, id: 'wamid.E2EEDGE', text: { body: 'Uma vez' } };
    const statuses = [
      (await postSignedMessage({ message, offsetMs: NO_OFFSET_MS })).status,
      (await postSignedMessage({ message, offsetMs: NO_OFFSET_MS })).status,
    ];
    expect(statuses).toEqual([STATUS_OK, STATUS_OK]);
    expect(messagesOf({ result: await checkInbox(), key: 'messages' }).map((message) => message.text)).toEqual(['Uma vez']);
  });

  test('E2E-2 a stored voice note reaches the agent with a url that serves its bytes', async () => {
    const downloadedBytes = new TextEncoder().encode(JSON.stringify(VOICE_NOTE_CONTENT));
    const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, downloadedBytes);
    const sha256 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    await fakeGraph.respondWith({
      method: 'GET',
      path: GRAPH_MEDIA_PATH,
      status: STATUS_OK,
      body: { url: `${FAKE_GRAPH_ORIGIN}${VOICE_DOWNLOAD_PATH}`, file_size: downloadedBytes.byteLength },
    });
    await fakeGraph.respondWith({ method: 'GET', path: VOICE_DOWNLOAD_PATH, status: STATUS_OK, body: VOICE_NOTE_CONTENT });
    const voiceNote = { ...audioVoiceFixture, id: 'wamid.E2E2STORED', audio: { ...audioVoiceFixture.audio, sha256 } };
    const response = await postSignedMessage({ message: voiceNote, offsetMs: NO_OFFSET_MS });
    expect(response.status).toBe(STATUS_OK);
    const [voice] = messagesOf({ result: await checkInbox(), key: 'messages' });
    expect(voice).toMatchObject({ kind: MessageKind.Audio, voice: true, media_status: null });
    if (voice?.url === null || voice?.url === undefined) throw new Error('the voice note has no url');
    const served = await fetch(voice.url);
    expect(served.status).toBe(STATUS_OK);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(downloadedBytes);
  });

  test('E2E-2 a voice note whose media the channel refuses reaches the agent as unavailable and the owner is told', async () => {
    await fakeGraph.respondWith({
      method: 'GET',
      path: GRAPH_MEDIA_PATH,
      status: STATUS_OK,
      body: { url: FOREIGN_MEDIA_URL, file_size: FAKE_FILE_SIZE_BYTES },
    });
    const response = await postSignedMessage({ message: { ...audioVoiceFixture, id: 'wamid.E2E2' }, offsetMs: NO_OFFSET_MS });
    expect(response.status).toBe(STATUS_OK);
    const [voice] = messagesOf({ result: await checkInbox(), key: 'messages' });
    expect(voice).toMatchObject({ kind: MessageKind.Audio, voice: true, media_status: MediaSourceKind.Unavailable });
    const notices = (await sentRequests()).map((request) => JSON.stringify(request.body));
    expect(notices.some((notice) => notice.includes(MEDIA_UNAVAILABLE_NOTICE))).toBe(true);
  });

  test('E2E-3 a signed reaction on the last agent message reaches the agent with its emoji', async () => {
    await sendText({ text: 'oi' });
    const reaction = { ...reactionFixture, reaction: { message_id: await lastSentWamid(), emoji: OWNER_EMOJI } };
    const response = await postSignedMessage({ message: { ...reaction, id: 'wamid.E2E3' }, offsetMs: NO_OFFSET_MS });
    expect(response.status).toBe(STATUS_OK);
    const [received] = messagesOf({ result: await checkInbox(), key: 'messages' });
    expect(received).toMatchObject({ kind: MessageKind.Reaction, emoji: OWNER_EMOJI });
  });

  test(
    'E2E-5 E2E-4 ask with four options sends the list, and a signed list reply answers it',
    async () => {
      const sentBefore = (await sentRequests()).length;
      askAnswer = callTool({
        client: agent,
        name: McpToolName.Ask,
        arguments: {
          question: QUESTION_TEXT,
          timeout_seconds: ASK_WAIT_SECONDS,
          options: [
            { title: 'Produção' },
            { title: ANSWER_TITLE, description: 'Ambiente de testes' },
            { title: 'Local' },
            { title: 'Sandbox' },
          ],
        },
      });
      await expect.poll(async () => (await sentRequests()).length, { timeout: POLL_TIMEOUT_MS }).toBe(sentBefore + 1);
      const listRequest = (await sentRequests()).at(-1);
      const rowId = (listRequest?.body as { interactive: { action: { sections: { rows: { id: string }[] }[] } } }).interactive.action
        .sections[0]?.rows[0]?.id;
      questionId = String(rowId).split(':')[0] as string;
      askWamid = await lastSentWamid();
      expect(listRequest?.body).toEqual(bodyOf({ json: listFixture, replacements: [[QUESTION_ID_PLACEHOLDER, questionId]] }));
      const response = await postSignedMessage({
        message: replyOf({ optionId: `${questionId}:${ANSWER_INDEX}`, contextId: askWamid }),
        offsetMs: NO_OFFSET_MS,
      });
      expect(response.status).toBe(STATUS_OK);
      expect((await askAnswer).structured).toMatchObject({ status: ReplyStatus.Answered, answer: ANSWER_TITLE });
    },
    ASK_TIMEOUT_MS,
  );

  test('E2E-8 a signed read status shows as read delivery in get_messages', async () => {
    const notification = notificationOf({
      changes: [changeOf({ statuses: [{ ...readStatusFixture, id: askWamid, recipient_id: OWNER_PHONE }] })],
    });
    expect((await postSignedWebhook({ notification })).status).toBe(STATUS_OK);
    const question = (await historyOf()).find(
      (message) => message.direction === MessageDirection.ToOwner && message.choice?.question_id === questionId,
    );
    expect(question?.delivery).toBe(DeliveryState.Read);
  });

  test('E2E-6 a send outside the window is queued and the owner gets one notice template', async () => {
    await advanceClock({ advanceMs: CLOSED_WINDOW_OFFSET_MS });
    const sentBefore = (await sentRequests()).length;
    const result = await sendText({ text: QUEUED_TEXT });
    expect(result.structured).toMatchObject({ delivery: DeliveryState.Queued });
    const requests = await sentRequests();
    expect(requests).toHaveLength(sentBefore + 1);
    expect(requests.at(-1)?.body).toEqual(
      bodyOf({
        json: templateFixture,
        replacements: [
          [TEMPLATE_AGENT_PLACEHOLDER, AGENT],
          [TEMPLATE_PREVIEW_PLACEHOLDER, QUEUED_TEXT],
        ],
      }),
    );
  });

  test('E2E-7 a signed quick-reply tap opens the window and sends the queued message once', async () => {
    const noticeWamid = await lastSentWamid();
    const sentBefore = (await sentRequests()).length;
    const tap = { ...buttonFixture, id: 'wamid.E2E7', context: { ...buttonFixture.context, id: noticeWamid } };
    const response = await postSignedMessage({ message: tap, offsetMs: CLOSED_WINDOW_OFFSET_MS });
    expect(response.status).toBe(STATUS_OK);
    const requests = await sentRequests();
    expect(requests).toHaveLength(sentBefore + 1);
    expect(requests.at(-1)?.body).toMatchObject({ to: OWNER_PHONE, type: 'text', text: { body: QUEUED_TEXT } });
    const queued = (await historyOf()).find((message) => message.text === QUEUED_TEXT);
    expect(queued?.delivery).toBe(DeliveryState.Sent);
  });

  test('the fake Graph only received sends for the configured number', async () => {
    const requests = await fakeGraph.requests();
    const foreign = requests.filter((request) => request.method === 'POST' && request.path !== GRAPH_MESSAGES_PATH);
    expect(foreign).toEqual([]);
    expect(PHONE_NUMBER_ID).toBeTruthy();
  });

  test('E2E-8 the owner reply that carries an install link is sent with link previews off', async () => {
    const sentBefore = (await sentRequests()).length;
    const command = { ...textFixture, id: 'wamid.E2E8', text: { body: NEW_AGENT_COMMAND } };
    const response = await postSignedMessage({ message: command, offsetMs: NO_OFFSET_MS });
    expect(response.status).toBe(STATUS_OK);
    const installReplies = (await sentRequests()).slice(sentBefore).map((request) => request.body as InstallReplyBody);
    const withLink = installReplies.filter((body) => body.text?.body.includes(INSTALL_LINK_MARK));
    expect(withLink).toHaveLength(1);
    expect(withLink[0]?.text?.preview_url).toBe(false);
  });
});
