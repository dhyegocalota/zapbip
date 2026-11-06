import {
  buildNoticePreview,
  formatRoutingListQuestionId,
  renderCopy,
  type Clock,
  type MediaStore,
  type Message,
  type MessageSender,
} from '@zapbip/core';
import { DEFAULT_LOCALE, InboxCopyKey, MessageKind, TemplateKind } from '@zapbip/types';
import type { ScreenEntry } from '../../contract/account-inbox-rpc';
import { resolveMediaLink } from '../../mcp/links';

export type FakeWhatsAppSender = MessageSender & { listScreenEntries(): Promise<ScreenEntry[]> };

type ScreenRow = { at: number; message_id: string | null; template: TemplateKind | null; text: string; options: string };

const INSERT_ENTRY_STATEMENT = 'INSERT INTO screen_entries (at, message_id, template, text, options) VALUES (?, ?, ?, ?, ?)';
const LIST_ENTRIES_STATEMENT = 'SELECT at, message_id, template, text, options FROM screen_entries ORDER BY id';
const FIND_QUESTION_STATEMENT = 'SELECT text FROM questions WHERE question_id = ?';
const CHANNEL_MESSAGE_ID_PREFIX = 'wamid.fake';

const TEMPLATE_COPY_KEYS: Record<TemplateKind, InboxCopyKey> = {
  [TemplateKind.Notice]: InboxCopyKey.NoticeBody,
  [TemplateKind.QuestionNotice]: InboxCopyKey.QuestionNoticeBody,
};

export function createFakeWhatsAppSender(input: {
  storage: DurableObjectStorage;
  clock: Clock;
  mediaStore: MediaStore;
  accountId: string;
  origin: string;
}): FakeWhatsAppSender {
  const { sql } = input.storage;

  function record(entry: { messageId: string | null; template: TemplateKind | null; text: string; options: string[] }): {
    channelMessageId: string;
  } {
    sql.exec(INSERT_ENTRY_STATEMENT, input.clock.now(), entry.messageId, entry.template, entry.text, JSON.stringify(entry.options));
    return { channelMessageId: `${CHANNEL_MESSAGE_ID_PREFIX}.${crypto.randomUUID()}` };
  }

  function describeChoicePrompt(choice: { message: Extract<Message, { kind: MessageKind.Choice }> }): string {
    const isRoutingList = choice.message.questionId.startsWith(formatRoutingListQuestionId({ messageId: '' }));
    if (isRoutingList) return renderCopy({ key: InboxCopyKey.RoutingPrompt, locale: DEFAULT_LOCALE, values: {} });
    const [question] = sql.exec<{ text: string }>(FIND_QUESTION_STATEMENT, choice.message.questionId).toArray();
    if (question === undefined) return buildNoticePreview({ content: choice.message, locale: DEFAULT_LOCALE });
    return question.text;
  }

  async function describeSession(message: Message): Promise<{ text: string; options: string[] }> {
    if (message.kind === MessageKind.Text) return { text: message.text, options: [] };
    if (message.kind === MessageKind.Choice)
      return { text: describeChoicePrompt({ message }), options: message.options.map((option) => option.title) };
    const preview = buildNoticePreview({ content: message, locale: DEFAULT_LOCALE });
    const link = await resolveMediaLink({ mediaStore: input.mediaStore, accountId: input.accountId, origin: input.origin, message });
    if (link === null) return { text: preview, options: [] };
    return { text: `${preview} ${link}`, options: [] };
  }

  return {
    async session({ message }) {
      return record({ messageId: message.messageId, template: null, ...(await describeSession(message)) });
    },

    async template({ kind, locale, parameters }) {
      const [agent, preview] = parameters;
      if (agent === undefined || preview === undefined) throw new Error('template: expected agent and preview parameters');
      const text = renderCopy({ key: TEMPLATE_COPY_KEYS[kind], locale, values: { agent, preview } });
      return record({ messageId: null, template: kind, text, options: [] });
    },

    async listScreenEntries() {
      return sql
        .exec<ScreenRow>(LIST_ENTRIES_STATEMENT)
        .toArray()
        .map((row) => ({
          at: row.at,
          messageId: row.message_id,
          template: row.template,
          text: row.text,
          options: JSON.parse(row.options),
        }));
    },
  };
}
