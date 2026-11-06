import {
  QUEUE_RETENTION_MS,
  QUESTION_RETENTION_MS,
  RECEIPT_RETENTION_MS,
  type AgentRecord,
  type Clock,
  type InboxRepository,
  type Message,
  type MessageContent,
  type OwnerWindow,
  type Question,
  type QuestionAnswer,
  type StoredMedia,
} from '@zapbip/core';
import { DeliveryState, MessageDirection, MessageKind, WakeMode, type MediaOrigin, type OwnerLocale } from '@zapbip/types';

type MessageRow = {
  id: string;
  agent: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  payload: string;
  reply_to: string | null;
  delivery: DeliveryState | null;
  read_at: number | null;
  at: number;
};

type QuestionRow = {
  question_id: string;
  agent: string;
  text: string;
  options: string;
  normalized_key: string;
  prompt_message_id: string;
  asked_at: number;
  answer: string | null;
};

type RoutingListRow = {
  routing_list_prompt_message_id: string | null;
  routing_list_opened_at: number | null;
  routing_list_locale: OwnerLocale | null;
  routing_list_resent: number;
  routing_list_reminded: number;
};

type MediaRow = {
  media_id: string;
  origin: MediaOrigin;
  mime_type: string;
  size_bytes: number;
  filename: string | null;
  expires_at: number | null;
  received_at: number | null;
  retention_until: number | null;
};

const SELECT_ROUTING_LIST =
  'SELECT routing_list_prompt_message_id, routing_list_opened_at, routing_list_locale, routing_list_resent, routing_list_reminded FROM owner_window WHERE id = ?';
const SELECT_MESSAGES = 'SELECT id, agent, direction, kind, payload, reply_to, delivery, read_at, at FROM inbox_messages ';
const SELECT_QUESTIONS = 'SELECT question_id, agent, text, options, normalized_key, prompt_message_id, asked_at, answer FROM questions ';
const SELECT_MEDIA = 'SELECT media_id, origin, mime_type, size_bytes, filename, expires_at, received_at, retention_until FROM media ';
const ORDER_BY_ARRIVAL = 'ORDER BY at, rowid';
const MARK_READ_STATEMENT = 'UPDATE inbox_messages SET read_at = ? WHERE read_at IS NULL AND id IN (SELECT value FROM json_each(?))';
const WINDOW_ROW_ID = 1;

function toMessage(row: MessageRow): Message {
  const content: MessageContent = JSON.parse(row.payload);
  return {
    messageId: row.id,
    direction: row.direction,
    agent: row.agent,
    at: row.at,
    replyToMessageId: row.reply_to,
    delivery: row.delivery,
    readByAgent: row.read_at !== null,
    ...content,
  };
}

function toQuestion(row: QuestionRow): Question {
  return {
    questionId: row.question_id,
    agent: row.agent,
    text: row.text,
    options: JSON.parse(row.options),
    normalizedKey: row.normalized_key,
    promptMessageId: row.prompt_message_id,
    askedAt: row.asked_at,
    answer: row.answer === null ? null : JSON.parse(row.answer),
  };
}

function toMedia(row: MediaRow): StoredMedia {
  return {
    mediaId: row.media_id,
    origin: row.origin,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    filename: row.filename,
    expiresAt: row.expires_at,
    receivedAt: row.received_at,
    retentionUntil: row.retention_until,
  };
}

export function createSqliteInboxRepository(input: { storage: DurableObjectStorage; clock: Clock }): InboxRepository {
  const { sql } = input.storage;

  function rows<Row extends Record<string, SqlStorageValue>>(statement: string, ...bindings: unknown[]): Row[] {
    return sql.exec<Row>(statement, ...bindings).toArray();
  }

  function first<Row extends Record<string, SqlStorageValue>>(statement: string, ...bindings: unknown[]): Row | null {
    const [row] = rows<Row>(statement, ...bindings);
    return row === undefined ? null : row;
  }

  function run(statement: string, ...bindings: unknown[]): void {
    sql.exec(statement, ...bindings);
  }

  function selectMessages(clause: string, ...bindings: unknown[]): Message[] {
    return rows<MessageRow>(SELECT_MESSAGES + clause, ...bindings).map(toMessage);
  }

  return {
    async registerAgent({ agent, seenAt }) {
      input.storage.transactionSync(() => {
        run(
          'INSERT INTO agents (agent, last_seen_at) VALUES (?, ?) ON CONFLICT (agent) DO UPDATE SET last_seen_at = excluded.last_seen_at',
          agent,
          seenAt,
        );
        run(
          'INSERT OR IGNORE INTO agent_wake (agent, mode, last_polled_at, updated_at) VALUES (?, ?, ?, ?)',
          agent,
          WakeMode.None,
          seenAt,
          seenAt,
        );
      });
    },

    async listAgents() {
      return rows<{ agent: string; last_seen_at: number }>('SELECT agent, last_seen_at FROM agents ORDER BY agent').map(
        (row): AgentRecord => ({ agent: row.agent, lastSeenAt: row.last_seen_at }),
      );
    },

    async insertMessage({ message }) {
      const { messageId, direction, agent, at, replyToMessageId, delivery, readByAgent, ...content } = message;
      run(
        'INSERT INTO inbox_messages (id, agent, direction, kind, payload, reply_to, delivery, read_at, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        messageId,
        agent,
        direction,
        message.kind,
        JSON.stringify(content),
        replyToMessageId,
        delivery,
        readByAgent ? input.clock.now() : null,
        at,
      );
    },

    async updateDelivery({ messageId, delivery }) {
      run('UPDATE inbox_messages SET delivery = ? WHERE id = ?', delivery, messageId);
    },

    async findMessage({ messageId }) {
      const [message] = selectMessages('WHERE id = ?', messageId);
      return message === undefined ? null : message;
    },

    async listAgentHistory({ agent, limit }) {
      return selectMessages('WHERE agent = ? ORDER BY at DESC, rowid DESC LIMIT ?', agent, limit).reverse();
    },

    async listUnread({ agent, limit }) {
      return selectMessages(
        'WHERE agent = ? AND direction = ? AND read_at IS NULL ' + ORDER_BY_ARRIVAL + ' LIMIT ?',
        agent,
        MessageDirection.FromOwner,
        limit,
      );
    },

    async countUnread({ agent }) {
      const row = first<{ unread: number }>(
        'SELECT COUNT(*) AS unread FROM inbox_messages WHERE agent = ? AND direction = ? AND read_at IS NULL',
        agent,
        MessageDirection.FromOwner,
      );
      if (row === null) throw new Error('unread count is missing');
      return row.unread;
    },

    async markRead({ messageIds }) {
      run(MARK_READ_STATEMENT, input.clock.now(), JSON.stringify(messageIds));
    },

    async listHeld() {
      return selectMessages('WHERE agent IS NULL AND direction = ? AND read_at IS NULL ' + ORDER_BY_ARRIVAL, MessageDirection.FromOwner);
    },

    async assignAgent({ messageIds, agent }) {
      run('UPDATE inbox_messages SET agent = ? WHERE id IN (SELECT value FROM json_each(?))', agent, JSON.stringify(messageIds));
    },

    async listQueued() {
      return selectMessages('WHERE delivery = ? ' + ORDER_BY_ARRIVAL, DeliveryState.Queued);
    },

    async findLastAgentWrite({ since }) {
      const row = first<{ agent: string }>(
        'SELECT agent FROM inbox_messages WHERE direction = ? AND agent IS NOT NULL AND at >= ? ORDER BY at DESC, rowid DESC LIMIT 1',
        MessageDirection.ToOwner,
        since,
      );
      return row === null ? null : row.agent;
    },

    async insertQuestion({ question }) {
      run(
        'INSERT INTO questions (question_id, agent, text, options, normalized_key, prompt_message_id, asked_at, answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        question.questionId,
        question.agent,
        question.text,
        JSON.stringify(question.options),
        question.normalizedKey,
        question.promptMessageId,
        question.askedAt,
        question.answer === null ? null : JSON.stringify(question.answer),
      );
    },

    async findQuestion({ questionId }) {
      const row = first<QuestionRow>(SELECT_QUESTIONS + 'WHERE question_id = ?', questionId);
      return row === null ? null : toQuestion(row);
    },

    async findRecentQuestion({ agent, normalizedKey, askedAfter }) {
      const row = first<QuestionRow>(
        SELECT_QUESTIONS + 'WHERE agent = ? AND normalized_key = ? AND asked_at >= ? ORDER BY asked_at DESC, rowid DESC LIMIT 1',
        agent,
        normalizedKey,
        askedAfter,
      );
      return row === null ? null : toQuestion(row);
    },

    async listOpenQuestions() {
      return rows<QuestionRow>(SELECT_QUESTIONS + 'WHERE answer IS NULL ORDER BY asked_at DESC, rowid DESC').map(toQuestion);
    },

    async saveAnswer({ questionId, answer }: { questionId: string; answer: QuestionAnswer }) {
      run('UPDATE questions SET answer = ? WHERE question_id = ?', JSON.stringify(answer), questionId);
    },

    async recordChannelReceipt({ wamid, receivedAt }) {
      return (
        rows(
          'INSERT INTO channel_receipts (wamid, received_at) VALUES (?, ?) ON CONFLICT (wamid) DO NOTHING RETURNING wamid',
          wamid,
          receivedAt,
        ).length === 1
      );
    },

    async linkChannelReceipt({ wamid, messageId }) {
      run('UPDATE channel_receipts SET message_id = ? WHERE wamid = ?', messageId, wamid);
    },

    async findChannelReceiptMessageId({ wamid }) {
      const row = first<{ message_id: string | null }>('SELECT message_id FROM channel_receipts WHERE wamid = ?', wamid);
      return row === null ? null : row.message_id;
    },

    async deleteExpiredReceipts({ receivedBefore }) {
      run('DELETE FROM channel_receipts WHERE received_at < ?', receivedBefore);
    },

    async deleteQuestionsAskedBefore({ askedBefore }) {
      run('DELETE FROM questions WHERE asked_at < ?', askedBefore);
    },

    async findWindow() {
      const row = first<{ last_owner_message_at: number | null; notice_sent_for_closed_window: number }>(
        'SELECT last_owner_message_at, notice_sent_for_closed_window FROM owner_window WHERE id = ?',
        WINDOW_ROW_ID,
      );
      if (row === null) throw new Error('owner_window row is missing');
      const window: OwnerWindow = {
        lastOwnerMessageAt: row.last_owner_message_at,
        noticeSentForClosedWindow: row.notice_sent_for_closed_window === 1,
      };
      return window;
    },

    async saveWindow({ window }) {
      run(
        'UPDATE owner_window SET last_owner_message_at = ?, notice_sent_for_closed_window = ? WHERE id = ?',
        window.lastOwnerMessageAt,
        window.noticeSentForClosedWindow ? 1 : 0,
        WINDOW_ROW_ID,
      );
    },

    async claimNotice() {
      return (
        rows(
          'UPDATE owner_window SET notice_sent_for_closed_window = 1 WHERE id = ? AND notice_sent_for_closed_window = 0 RETURNING id',
          WINDOW_ROW_ID,
        ).length === 1
      );
    },

    async findRoutingList() {
      const row = first<RoutingListRow>(SELECT_ROUTING_LIST, WINDOW_ROW_ID);
      if (row === null) throw new Error('owner_window row is missing');
      if (row.routing_list_prompt_message_id === null) return null;
      if (row.routing_list_opened_at === null || row.routing_list_locale === null) throw new Error('routing list row is incomplete');
      return {
        promptMessageId: row.routing_list_prompt_message_id,
        openedAt: row.routing_list_opened_at,
        locale: row.routing_list_locale,
        resent: row.routing_list_resent === 1,
        reminded: row.routing_list_reminded === 1,
      };
    },

    async saveRoutingList({ routingList }) {
      run(
        'UPDATE owner_window SET routing_list_prompt_message_id = ?, routing_list_opened_at = ?, routing_list_locale = ?, routing_list_resent = ?, routing_list_reminded = ? WHERE id = ?',
        routingList.promptMessageId,
        routingList.openedAt,
        routingList.locale,
        routingList.resent ? 1 : 0,
        routingList.reminded ? 1 : 0,
        WINDOW_ROW_ID,
      );
    },

    async clearRoutingList() {
      run(
        'UPDATE owner_window SET routing_list_prompt_message_id = NULL, routing_list_opened_at = NULL, routing_list_locale = NULL, routing_list_resent = 0, routing_list_reminded = 0 WHERE id = ?',
        WINDOW_ROW_ID,
      );
    },

    async claimRoutingListExpiry({ openedAt, claimedAt }) {
      return (
        rows(
          'UPDATE owner_window SET routing_list_opened_at = ?, routing_list_resent = 1 WHERE id = ? AND routing_list_opened_at = ? RETURNING id',
          claimedAt,
          WINDOW_ROW_ID,
          openedAt,
        ).length === 1
      );
    },

    async insertMedia({ media }) {
      run(
        'INSERT INTO media (media_id, origin, mime_type, size_bytes, filename, expires_at, received_at, retention_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        media.mediaId,
        media.origin,
        media.mimeType,
        media.sizeBytes,
        media.filename,
        media.expiresAt,
        media.receivedAt,
        media.retentionUntil,
      );
    },

    async findMedia({ mediaId }) {
      const row = first<MediaRow>(SELECT_MEDIA + 'WHERE media_id = ?', mediaId);
      return row === null ? null : toMedia(row);
    },

    async claimUpload({ mediaId, claimedAt, staleBefore }) {
      return (
        rows(
          'UPDATE media SET claimed_at = ? WHERE media_id = ? AND received_at IS NULL AND (claimed_at IS NULL OR claimed_at <= ?) RETURNING media_id',
          claimedAt,
          mediaId,
          staleBefore,
        ).length === 1
      );
    },

    async releaseUpload({ mediaId }) {
      run('UPDATE media SET claimed_at = NULL WHERE media_id = ?', mediaId);
    },

    async markMediaReceived({ mediaId, receivedAt, retentionUntil }) {
      run(
        'UPDATE media SET received_at = ?, retention_until = ?, expires_at = NULL, claimed_at = NULL WHERE media_id = ?',
        receivedAt,
        retentionUntil,
        mediaId,
      );
    },

    async listExpiredMediaIds({ now }) {
      return rows<{ media_id: string }>(
        'SELECT media_id FROM media WHERE (received_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?) OR (retention_until IS NOT NULL AND retention_until <= ?)',
        now,
        now,
      ).map((row) => row.media_id);
    },

    async deleteMedia({ mediaIds }) {
      run('DELETE FROM media WHERE media_id IN (SELECT value FROM json_each(?))', JSON.stringify(mediaIds));
    },

    async findNextExpiry() {
      const row = first<{ due: number | null }>(
        `SELECT MIN(due) AS due FROM (
          SELECT expires_at AS due FROM media WHERE received_at IS NULL AND expires_at IS NOT NULL
          UNION ALL SELECT retention_until FROM media WHERE retention_until IS NOT NULL
          UNION ALL SELECT at + ? FROM inbox_messages WHERE delivery = ?
          UNION ALL SELECT asked_at + ? FROM questions
          UNION ALL SELECT received_at + ? FROM channel_receipts
        )`,
        QUEUE_RETENTION_MS,
        DeliveryState.Queued,
        QUESTION_RETENTION_MS,
        RECEIPT_RETENTION_MS,
      );
      return row === null ? null : row.due;
    },
  };
}
