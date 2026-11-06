import { DeliveryState, MediaOrigin, MessageDirection, MessageKind, OwnerLocale } from '@zapbip/types';
import { MEDIA_RETENTION_MS, QUEUE_RETENTION_MS, type RoutingList, type StoredMedia } from '@zapbip/core';
import { afterEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { withRepository } from '../support/account-inbox';
import { BASE_TIME, buildEnvelope, buildEveryKind, buildQuestion, buildTextMessage } from '../support/builders';

const ACCOUNT_ID = 'acc_repository';

function inRepository<Result>(run: Parameters<typeof withRepository<Result>>[0]['run']): Promise<Result> {
  return withRepository({ accountId: ACCOUNT_ID, run });
}

function buildMedia(input: Partial<StoredMedia> & { mediaId: string }): StoredMedia {
  return {
    origin: MediaOrigin.Upload,
    mimeType: 'application/pdf',
    sizeBytes: 1000,
    filename: 'a.pdf',
    expiresAt: null,
    receivedAt: null,
    retentionUntil: null,
    ...input,
  };
}

afterEach(reset);

describe('SQLite inbox repository', () => {
  it('CU-159 round-trips every message kind', async () => {
    const messages = buildEveryKind();
    const stored = await inRepository(async (repository) => {
      await Promise.all(messages.map((message) => repository.insertMessage({ message })));
      return Promise.all(messages.map((message) => repository.findMessage({ messageId: message.messageId })));
    });
    expect(stored).toEqual(messages);
  });

  it('finds nothing for an unknown message', async () => {
    expect(await inRepository((repository) => repository.findMessage({ messageId: 'msg_none' }))).toBeNull();
  });

  it('updates delivery', async () => {
    const message = buildTextMessage({ messageId: 'msg_1', delivery: DeliveryState.Queued });
    const stored = await inRepository(async (repository) => {
      await repository.insertMessage({ message });
      await repository.updateDelivery({ messageId: 'msg_1', delivery: DeliveryState.Sent });
      return repository.findMessage({ messageId: 'msg_1' });
    });
    expect(stored?.delivery).toBe(DeliveryState.Sent);
  });

  it('WI-13 lists the last messages of an agent in order', async () => {
    const messages = Array.from({ length: 25 }, (_, index) => buildTextMessage({ messageId: `msg_${index}`, at: BASE_TIME + index }));
    const history = await inRepository(async (repository) => {
      await Promise.all(messages.map((message) => repository.insertMessage({ message })));
      return repository.listAgentHistory({ agent: 'alpha', limit: 20 });
    });
    expect(history.map((message) => message.messageId)).toEqual(messages.slice(5).map((message) => message.messageId));
  });

  it('keeps one agent history apart from another', async () => {
    const history = await inRepository(async (repository) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_a', agent: 'alpha' }) });
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_b', agent: 'beta' }) });
      return repository.listAgentHistory({ agent: 'alpha', limit: 20 });
    });
    expect(history.map((message) => message.messageId)).toEqual(['msg_a']);
  });

  it('lists unread owner messages oldest first, counts and marks them read', async () => {
    const ownerMessage = (index: number) =>
      buildTextMessage({ messageId: `msg_${index}`, direction: MessageDirection.FromOwner, delivery: null, at: BASE_TIME + index });
    const result = await inRepository(async (repository) => {
      await Promise.all([3, 1, 2].map((index) => repository.insertMessage({ message: ownerMessage(index) })));
      const unread = await repository.listUnread({ agent: 'alpha', limit: 2 });
      const countBefore = await repository.countUnread({ agent: 'alpha' });
      await repository.markRead({ messageIds: ['msg_1'] });
      const countAfter = await repository.countUnread({ agent: 'alpha' });
      const marked = await repository.findMessage({ messageId: 'msg_1' });
      return { unread: unread.map((message) => message.messageId), countBefore, countAfter, readByAgent: marked?.readByAgent };
    });
    expect(result).toEqual({ unread: ['msg_1', 'msg_2'], countBefore: 3, countAfter: 2, readByAgent: true });
  });

  it('stamps a read message with the injected clock', async () => {
    const readAt = BASE_TIME + 500;
    const clock = { now: () => readAt, schedule: () => ({ cancel: () => undefined }) };
    const stored = await withRepository({
      accountId: ACCOUNT_ID,
      clock,
      run: async (repository, storage) => {
        await repository.insertMessage({
          message: buildTextMessage({ messageId: 'msg_1', direction: MessageDirection.FromOwner, delivery: null }),
        });
        await repository.markRead({ messageIds: ['msg_1'] });
        return storage.sql.exec<{ read_at: number }>('SELECT read_at FROM inbox_messages').one().read_at;
      },
    });
    expect(stored).toBe(readAt);
  });

  it('lists held owner messages and assigns them to an agent', async () => {
    const held = buildTextMessage({ messageId: 'msg_held', direction: MessageDirection.FromOwner, delivery: null, agent: null });
    const result = await inRepository(async (repository) => {
      await repository.insertMessage({ message: held });
      const before = await repository.listHeld();
      await repository.assignAgent({ messageIds: ['msg_held'], agent: 'beta' });
      return { before, after: await repository.listHeld(), assigned: await repository.findMessage({ messageId: 'msg_held' }) };
    });
    expect(result.before).toEqual([held]);
    expect(result.after).toEqual([]);
    expect(result.assigned?.agent).toBe('beta');
  });

  it('lists queued messages oldest first', async () => {
    const queued = (index: number) =>
      buildTextMessage({ messageId: `msg_${index}`, delivery: DeliveryState.Queued, at: BASE_TIME + index });
    const ids = await inRepository(async (repository) => {
      await Promise.all([2, 1].map((index) => repository.insertMessage({ message: queued(index) })));
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_sent' }) });
      return (await repository.listQueued()).map((message) => message.messageId);
    });
    expect(ids).toEqual(['msg_1', 'msg_2']);
  });

  it('finds the last agent that wrote since a time', async () => {
    const result = await inRepository(async (repository) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_old', agent: 'alpha', at: BASE_TIME }) });
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_new', agent: 'beta', at: BASE_TIME + 10 }) });
      return {
        recent: await repository.findLastAgentWrite({ since: BASE_TIME }),
        none: await repository.findLastAgentWrite({ since: BASE_TIME + 11 }),
      };
    });
    expect(result).toEqual({ recent: 'beta', none: null });
  });

  it('registers agents once and lists them', async () => {
    const agents = await inRepository(async (repository) => {
      await repository.registerAgent({ agent: 'beta', seenAt: BASE_TIME });
      await repository.registerAgent({ agent: 'alpha', seenAt: BASE_TIME });
      await repository.registerAgent({ agent: 'beta', seenAt: BASE_TIME + 5 });
      return repository.listAgents();
    });
    expect(agents).toEqual([
      { agent: 'alpha', lastSeenAt: BASE_TIME },
      { agent: 'beta', lastSeenAt: BASE_TIME + 5 },
    ]);
  });

  it('writes the agent wake row on first contact only', async () => {
    const rows = await inRepository(async (repository, storage) => {
      await repository.registerAgent({ agent: 'alpha', seenAt: BASE_TIME });
      await repository.registerAgent({ agent: 'alpha', seenAt: BASE_TIME + 5 });
      return storage.sql.exec('SELECT agent, mode, last_polled_at FROM agent_wake').toArray();
    });
    expect(rows).toEqual([{ agent: 'alpha', mode: 'none', last_polled_at: BASE_TIME }]);
  });

  it('stores a question and its answer', async () => {
    const question = buildQuestion({ questionId: 'qst_1' });
    const answer = { optionIndex: 0, text: 'Sim', answerMessageId: 'msg_answer', answeredAt: BASE_TIME + 1 };
    const result = await inRepository(async (repository) => {
      await repository.insertQuestion({ question });
      const open = await repository.listOpenQuestions();
      await repository.saveAnswer({ questionId: 'qst_1', answer });
      return { open, answered: await repository.findQuestion({ questionId: 'qst_1' }), openAfter: await repository.listOpenQuestions() };
    });
    expect(result.open).toEqual([question]);
    expect(result.answered).toEqual({ ...question, answer });
    expect(result.openAfter).toEqual([]);
  });

  it('lists open questions newest first', async () => {
    const ids = await inRepository(async (repository) => {
      await repository.insertQuestion({ question: buildQuestion({ questionId: 'qst_old', askedAt: BASE_TIME }) });
      await repository.insertQuestion({ question: buildQuestion({ questionId: 'qst_new', askedAt: BASE_TIME + 1 }) });
      return (await repository.listOpenQuestions()).map((question) => question.questionId);
    });
    expect(ids).toEqual(['qst_new', 'qst_old']);
  });

  it('finds no question for an unknown id', async () => {
    expect(await inRepository((repository) => repository.findQuestion({ questionId: 'qst_none' }))).toBeNull();
  });

  it('WI-12 scopes the recent question lookup', async () => {
    const question = buildQuestion({ questionId: 'qst_1', normalizedKey: 'k', askedAt: BASE_TIME });
    const result = await inRepository(async (repository) => {
      await repository.insertQuestion({ question });
      return {
        otherAgent: await repository.findRecentQuestion({ agent: 'beta', normalizedKey: 'k', askedAfter: BASE_TIME - 1 }),
        otherKey: await repository.findRecentQuestion({ agent: 'alpha', normalizedKey: 'other', askedAfter: BASE_TIME - 1 }),
        atBoundary: await repository.findRecentQuestion({ agent: 'alpha', normalizedKey: 'k', askedAfter: BASE_TIME }),
        tooLate: await repository.findRecentQuestion({ agent: 'alpha', normalizedKey: 'k', askedAfter: BASE_TIME + 1 }),
        match: await repository.findRecentQuestion({ agent: 'alpha', normalizedKey: 'k', askedAfter: BASE_TIME - 1 }),
      };
    });
    expect(result).toEqual({ otherAgent: null, otherKey: null, atBoundary: question, tooLate: null, match: question });
  });

  it('records a channel receipt once', async () => {
    const result = await inRepository(async (repository) => ({
      first: await repository.recordChannelReceipt({ wamid: 'wamid.1', receivedAt: BASE_TIME }),
      second: await repository.recordChannelReceipt({ wamid: 'wamid.1', receivedAt: BASE_TIME }),
    }));
    expect(result).toEqual({ first: true, second: false });
  });

  it('deletes expired receipts and old questions', async () => {
    const result = await inRepository(async (repository) => {
      await repository.recordChannelReceipt({ wamid: 'wamid.old', receivedAt: BASE_TIME });
      await repository.recordChannelReceipt({ wamid: 'wamid.new', receivedAt: BASE_TIME + 10 });
      await repository.deleteExpiredReceipts({ receivedBefore: BASE_TIME + 5 });
      await repository.insertQuestion({ question: buildQuestion({ questionId: 'qst_old', askedAt: BASE_TIME }) });
      await repository.insertQuestion({ question: buildQuestion({ questionId: 'qst_new', askedAt: BASE_TIME + 10 }) });
      await repository.deleteQuestionsAskedBefore({ askedBefore: BASE_TIME + 5 });
      return {
        oldReceiptAgain: await repository.recordChannelReceipt({ wamid: 'wamid.old', receivedAt: BASE_TIME + 20 }),
        newReceiptAgain: await repository.recordChannelReceipt({ wamid: 'wamid.new', receivedAt: BASE_TIME + 20 }),
        questions: (await repository.listOpenQuestions()).map((question) => question.questionId),
      };
    });
    expect(result).toEqual({ oldReceiptAgain: true, newReceiptAgain: false, questions: ['qst_new'] });
  });

  it('starts with a closed window and saves a new one', async () => {
    const result = await inRepository(async (repository) => {
      const initial = await repository.findWindow();
      await repository.saveWindow({ window: { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: true } });
      return { initial, saved: await repository.findWindow() };
    });
    expect(result).toEqual({
      initial: { lastOwnerMessageAt: null, noticeSentForClosedWindow: false },
      saved: { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: true },
    });
  });

  it('claims the notice exactly once per closed window', async () => {
    const result = await inRepository(async (repository) => {
      const first = await repository.claimNotice();
      const second = await repository.claimNotice();
      await repository.saveWindow({ window: { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false } });
      return { first, second, afterReset: await repository.claimNotice() };
    });
    expect(result).toEqual({ first: true, second: false, afterReset: true });
  });

  it('claims an upload exactly once until it is released, received or stale', async () => {
    const claim = { mediaId: 'med_1', claimedAt: BASE_TIME, staleBefore: BASE_TIME - 1 };
    const result = await inRepository(async (repository) => {
      await repository.insertMedia({ media: buildMedia({ mediaId: 'med_1', expiresAt: BASE_TIME + 5 }) });
      const first = await repository.claimUpload(claim);
      const second = await repository.claimUpload(claim);
      const whileFresh = await repository.claimUpload({ ...claim, claimedAt: BASE_TIME + 1 });
      const whenStale = await repository.claimUpload({ ...claim, claimedAt: BASE_TIME + 2, staleBefore: BASE_TIME });
      await repository.releaseUpload({ mediaId: 'med_1' });
      const afterRelease = await repository.claimUpload(claim);
      await repository.markMediaReceived({ mediaId: 'med_1', receivedAt: BASE_TIME, retentionUntil: BASE_TIME + MEDIA_RETENTION_MS });
      return { first, second, whileFresh, whenStale, afterRelease, afterReceived: await repository.claimUpload(claim) };
    });
    expect(result).toEqual({ first: true, second: false, whileFresh: false, whenStale: true, afterRelease: true, afterReceived: false });
  });

  it('claims the routing list expiry once per opening time', async () => {
    const routingList: RoutingList = {
      promptMessageId: 'msg_1',
      openedAt: BASE_TIME,
      locale: OwnerLocale.EnglishUs,
      resent: false,
      reminded: false,
    };
    const result = await inRepository(async (repository) => {
      await repository.saveRoutingList({ routingList });
      const first = await repository.claimRoutingListExpiry({ openedAt: BASE_TIME, claimedAt: BASE_TIME + 10 });
      const second = await repository.claimRoutingListExpiry({ openedAt: BASE_TIME, claimedAt: BASE_TIME + 10 });
      return { first, second, claimed: await repository.findRoutingList() };
    });
    expect(result).toEqual({ first: true, second: false, claimed: { ...routingList, openedAt: BASE_TIME + 10, resent: true } });
  });

  it('stores media, marks it received and deletes it', async () => {
    const media = buildMedia({ mediaId: 'med_1', expiresAt: BASE_TIME + 5 });
    const result = await inRepository(async (repository) => {
      await repository.insertMedia({ media });
      await repository.markMediaReceived({ mediaId: 'med_1', receivedAt: BASE_TIME, retentionUntil: BASE_TIME + MEDIA_RETENTION_MS });
      const received = await repository.findMedia({ mediaId: 'med_1' });
      await repository.deleteMedia({ mediaIds: ['med_1'] });
      return { received, deleted: await repository.findMedia({ mediaId: 'med_1' }) };
    });
    expect(result.received).toEqual({ ...media, expiresAt: null, receivedAt: BASE_TIME, retentionUntil: BASE_TIME + MEDIA_RETENTION_MS });
    expect(result.deleted).toBeNull();
  });

  it('lists media expired by upload deadline or retention', async () => {
    const ids = await inRepository(async (repository) => {
      await repository.insertMedia({ media: buildMedia({ mediaId: 'med_pending_old', expiresAt: BASE_TIME - 1 }) });
      await repository.insertMedia({ media: buildMedia({ mediaId: 'med_pending_new', expiresAt: BASE_TIME + 100 }) });
      await repository.insertMedia({
        media: buildMedia({ mediaId: 'med_kept_old', origin: MediaOrigin.Owner, receivedAt: BASE_TIME - 9, retentionUntil: BASE_TIME - 1 }),
      });
      await repository.insertMedia({
        media: buildMedia({ mediaId: 'med_kept_new', origin: MediaOrigin.Owner, receivedAt: BASE_TIME, retentionUntil: BASE_TIME + 100 }),
      });
      return (await repository.listExpiredMediaIds({ now: BASE_TIME })).sort();
    });
    expect(ids).toEqual(['med_kept_old', 'med_pending_old']);
  });

  it('WI-10 finds the earliest expiry across uploads, retention and the queue', async () => {
    const next = await inRepository(async (repository) => {
      await repository.insertMedia({ media: buildMedia({ mediaId: 'med_pending', expiresAt: BASE_TIME + 5 }) });
      await repository.insertMedia({
        media: buildMedia({ mediaId: 'med_kept', origin: MediaOrigin.Owner, receivedAt: BASE_TIME, retentionUntil: BASE_TIME + 9 }),
      });
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_q', delivery: DeliveryState.Queued, at: BASE_TIME }) });
      return repository.findNextExpiry();
    });
    expect(next).toBe(BASE_TIME + 5);
  });

  it('WI-10 counts a queued message at its retention deadline', async () => {
    const next = await inRepository(async (repository) => {
      await repository.insertMessage({ message: buildTextMessage({ messageId: 'msg_q', delivery: DeliveryState.Queued, at: BASE_TIME }) });
      return repository.findNextExpiry();
    });
    expect(next).toBe(BASE_TIME + QUEUE_RETENTION_MS);
  });

  it('WI-11 finds no expiry when nothing is stored', async () => {
    expect(await inRepository((repository) => repository.findNextExpiry())).toBeNull();
  });

  it('keeps messages of unrelated kinds out of the queue expiry', async () => {
    const next = await inRepository(async (repository) => {
      await repository.insertMessage({ message: { ...buildEnvelope({ messageId: 'msg_s' }), kind: MessageKind.Text, text: 'oi' } });
      return repository.findNextExpiry();
    });
    expect(next).toBeNull();
  });

  it('keeps a message stored as read out of the held list', async () => {
    const held = buildTextMessage({ messageId: 'msg_held', direction: MessageDirection.FromOwner, agent: null });
    const routedNowhere = buildTextMessage({
      messageId: 'msg_nowhere',
      direction: MessageDirection.FromOwner,
      agent: null,
      readByAgent: true,
    });
    const result = await inRepository(async (repository) => {
      await Promise.all([held, routedNowhere].map((message) => repository.insertMessage({ message })));
      return {
        heldIds: (await repository.listHeld()).map((message) => message.messageId),
        stored: await repository.findMessage({ messageId: 'msg_nowhere' }),
      };
    });
    expect(result.heldIds).toEqual(['msg_held']);
    expect(result.stored?.readByAgent).toBe(true);
  });

  it('keeps the open routing list in the owner window row', async () => {
    const routingList: RoutingList = {
      promptMessageId: 'msg_list',
      openedAt: BASE_TIME,
      locale: OwnerLocale.PortugueseBrazil,
      resent: true,
      reminded: false,
    };
    const result = await inRepository(async (repository) => {
      const initial = await repository.findRoutingList();
      await repository.saveRoutingList({ routingList });
      await repository.saveWindow({ window: { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false } });
      const saved = await repository.findRoutingList();
      await repository.saveRoutingList({ routingList: { ...routingList, reminded: true } });
      const reminded = await repository.findRoutingList();
      await repository.clearRoutingList();
      return { initial, saved, reminded, cleared: await repository.findRoutingList() };
    });
    expect(result).toEqual({ initial: null, saved: routingList, reminded: { ...routingList, reminded: true }, cleared: null });
  });

  it('links a channel receipt to its message and forgets it with the receipt', async () => {
    const result = await inRepository(async (repository) => {
      await repository.recordChannelReceipt({ wamid: 'wamid.1', receivedAt: BASE_TIME });
      await repository.linkChannelReceipt({ wamid: 'wamid.1', messageId: 'msg_1' });
      const linked = await repository.findChannelReceiptMessageId({ wamid: 'wamid.1' });
      await repository.deleteExpiredReceipts({ receivedBefore: BASE_TIME + 1 });
      return { linked, afterDelete: await repository.findChannelReceiptMessageId({ wamid: 'wamid.1' }) };
    });
    expect(result).toEqual({ linked: 'msg_1', afterDelete: null });
  });

  it('WI-133 pin: window writes keep the routing list and list writes keep the window', async () => {
    const list: RoutingList = {
      promptMessageId: 'msg_list',
      openedAt: BASE_TIME,
      locale: OwnerLocale.PortugueseBrazil,
      resent: true,
      reminded: true,
    };
    const result = await inRepository(async (repository) => {
      await repository.saveWindow({ window: { lastOwnerMessageAt: BASE_TIME, noticeSentForClosedWindow: false } });
      await repository.saveRoutingList({ routingList: list });
      await repository.claimNotice();
      await repository.saveWindow({ window: { lastOwnerMessageAt: BASE_TIME + 5, noticeSentForClosedWindow: true } });
      const afterWindow = await repository.findRoutingList();
      const window = await repository.findWindow();
      await repository.clearRoutingList();
      return { afterWindow, window, windowAfterClear: await repository.findWindow(), cleared: await repository.findRoutingList() };
    });
    expect(result.afterWindow).toEqual(list);
    expect(result.window).toEqual({ lastOwnerMessageAt: BASE_TIME + 5, noticeSentForClosedWindow: true });
    expect(result.windowAfterClear).toEqual(result.window);
    expect(result.cleared).toBeNull();
  });

  it('WI-134 pin: clearing resets resent and reminded, and clearing with no list is a no-op', async () => {
    const list: RoutingList = {
      promptMessageId: 'msg_list',
      openedAt: BASE_TIME,
      locale: OwnerLocale.PortugueseBrazil,
      resent: true,
      reminded: true,
    };
    const result = await inRepository(async (repository) => {
      await repository.clearRoutingList();
      await repository.saveRoutingList({ routingList: list });
      await repository.clearRoutingList();
      await repository.saveRoutingList({ routingList: { ...list, resent: false, reminded: false } });
      return repository.findRoutingList();
    });
    expect(result).toEqual({ ...list, resent: false, reminded: false });
  });

  it('WI-135 pin: a second save replaces the first and an openedAt of zero round-trips', async () => {
    const list: RoutingList = {
      promptMessageId: 'msg_list',
      openedAt: BASE_TIME,
      locale: OwnerLocale.PortugueseBrazil,
      resent: false,
      reminded: false,
    };
    const result = await inRepository(async (repository) => {
      await repository.saveRoutingList({ routingList: list });
      await repository.saveRoutingList({ routingList: { ...list, promptMessageId: 'msg_other', openedAt: 0 } });
      return repository.findRoutingList();
    });
    expect(result).toMatchObject({ promptMessageId: 'msg_other', openedAt: 0 });
  });

  it('WI-136 pin: two accounts keep separate routing lists', async () => {
    const list: RoutingList = {
      promptMessageId: 'msg_list',
      openedAt: BASE_TIME,
      locale: OwnerLocale.PortugueseBrazil,
      resent: false,
      reminded: false,
    };
    await withRepository({ accountId: 'acc_one', run: (repository) => repository.saveRoutingList({ routingList: list }) });
    const other = await withRepository({ accountId: 'acc_two', run: (repository) => repository.findRoutingList() });
    const one = await withRepository({ accountId: 'acc_one', run: (repository) => repository.findRoutingList() });
    expect(other).toBeNull();
    expect(one).toEqual(list);
  });
});
