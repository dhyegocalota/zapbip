import { MessageDirection, OwnerLocale, WakeMode, WakeStatus } from '@zapbip/types';
import type { InboxRepository, StoredWake, WakeRepository } from '@zapbip/core';
import { runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations } from '../../src/account-inbox/run-migrations';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { createSqliteInboxRepository } from '../../src/adapters/sqlite/sqlite-inbox-repository';
import { createSqliteWakeRepository } from '../../src/adapters/sqlite/sqlite-wake-repository';
import { BASE_TIME, buildTextMessage } from '../support/builders';
import { accountInboxStub } from '../support/workers-env';

const ACCOUNT_ID = 'acc_scheduled_storage';
const MIGRATION_ACCOUNT_ID = 'acc_scheduled_migration';
const SCHEDULED_AGENT = 'chatgpt';
const OTHER_SCHEDULED_AGENT = 'claude-ai';
const WEBHOOK_AGENT = 'grok-bot';
const STANDBY_AGENT = 'grok-web';
const SCHEDULED_INTERVAL_MINUTES = 60;
const POLLED_AT = BASE_TIME + 5_000;
const NOTICED_AT = 2_000;
const FIRST_VERSION = 1;
const SECOND_VERSION = 2;
const THIRD_VERSION = 3;

type Repositories = { inbox: InboxRepository; wake: WakeRepository; storage: DurableObjectStorage };

function storedWake(input: Partial<StoredWake> & { agent: string }): StoredWake {
  return {
    mode: WakeMode.None,
    target: null,
    status: WakeStatus.Active,
    lastDeliveredAt: null,
    intervalMinutes: null,
    standbyAgent: null,
    ownerLocale: null,
    ...input,
  };
}

function scheduledWake(input: { agent: string }): StoredWake {
  return storedWake({
    agent: input.agent,
    mode: WakeMode.Scheduled,
    intervalMinutes: SCHEDULED_INTERVAL_MINUTES,
    ownerLocale: OwnerLocale.PortugueseBrazil,
  });
}

function inRepositories<Result>(input: {
  accountId?: string;
  agents?: string[];
  run: (repositories: Repositories) => Promise<Result>;
}): Promise<Result> {
  const { accountId = ACCOUNT_ID, agents = [SCHEDULED_AGENT], run } = input;
  return runInDurableObject(accountInboxStub({ accountId }), async (_instance, state) => {
    runMigrations({ storage: state.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
    const clock = createPlatformClock();
    const inbox = createSqliteInboxRepository({ storage: state.storage, clock });
    await Promise.all(agents.map((agent) => inbox.registerAgent({ agent, seenAt: BASE_TIME })));
    return run({ inbox, wake: createSqliteWakeRepository({ storage: state.storage, clock }), storage: state.storage });
  });
}

function readAgentWakeRow(input: { storage: DurableObjectStorage; agent: string }): Record<string, SqlStorageValue> {
  return input.storage.sql.exec('SELECT * FROM agent_wake WHERE agent = ?', input.agent).one();
}

function readMessageRow(input: { storage: DurableObjectStorage; messageId: string }): Record<string, SqlStorageValue> {
  return input.storage.sql.exec('SELECT * FROM inbox_messages WHERE id = ?', input.messageId).one();
}

function ownerMessage(input: { messageId: string; agent: string; at?: number; readByAgent?: boolean }) {
  return buildTextMessage({
    direction: MessageDirection.FromOwner,
    delivery: null,
    ...input,
  });
}

function dropEveryTable(input: { storage: DurableObjectStorage }): void {
  const names = input.storage.sql
    .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
    .toArray();
  names.forEach(({ name }) => input.storage.sql.exec(`DROP TABLE ${name}`));
}

afterEach(reset);

describe('schema v3', () => {
  it('upgrades an object that applied v1 and v2 and keeps its rows', async () => {
    const result = await runInDurableObject(accountInboxStub({ accountId: MIGRATION_ACCOUNT_ID }), async (_instance, state) => {
      dropEveryTable({ storage: state.storage });
      const versionsBefore = ACCOUNT_INBOX_MIGRATIONS.filter((migration) => migration.version <= SECOND_VERSION);
      runMigrations({ storage: state.storage, migrations: versionsBefore });
      state.storage.sql.exec("INSERT INTO agents (agent, last_seen_at) VALUES ('alpha', 1), ('beta', 2)");
      state.storage.sql.exec(
        "INSERT INTO agent_wake (agent, mode, last_polled_at, updated_at) VALUES ('alpha', 'none', 1, 1), ('beta', 'none', 2, 2)",
      );
      state.storage.sql.exec(
        "INSERT INTO inbox_messages (id, agent, direction, kind, payload, at) VALUES ('m1', 'alpha', 'from_owner', 'text', '{}', 1), ('m2', 'beta', 'from_owner', 'text', '{}', 2)",
      );
      const applied = runMigrations({ storage: state.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
      return {
        applied,
        agents: state.storage.sql.exec('SELECT agent FROM agents').toArray().length,
        messages: state.storage.sql.exec('SELECT id FROM inbox_messages').toArray().length,
        hasPolled: state.storage.sql
          .exec<{ has_polled: number }>('SELECT has_polled FROM agent_wake')
          .toArray()
          .map((row) => row.has_polled),
      };
    });
    const laterVersions = ACCOUNT_INBOX_MIGRATIONS.filter((migration) => migration.version > SECOND_VERSION).map(
      (migration) => migration.version,
    );
    expect(result).toEqual({ applied: laterVersions, agents: 2, messages: 2, hasPolled: [0, 0] });
  });

  it('applies v3 alone when v2 is missing', async () => {
    const applied = await runInDurableObject(accountInboxStub({ accountId: MIGRATION_ACCOUNT_ID }), async (_instance, state) => {
      dropEveryTable({ storage: state.storage });
      const migrationOf = (version: number) => ACCOUNT_INBOX_MIGRATIONS.filter((migration) => migration.version === version);
      runMigrations({ storage: state.storage, migrations: migrationOf(FIRST_VERSION) });
      return runMigrations({ storage: state.storage, migrations: [...migrationOf(FIRST_VERSION), ...migrationOf(THIRD_VERSION)] });
    });
    expect(applied).toEqual([THIRD_VERSION]);
  });

  it('refuses a second message with the same id', async () => {
    const failure = inRepositories({
      run: async ({ inbox }) => {
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm1', agent: 'alpha' }) });
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm1', agent: 'beta' }) });
      },
    });
    await expect(failure).rejects.toThrow(/UNIQUE/);
  });
});

describe('wake settings', () => {
  it('finds neither a wake nor a poll state for an unknown agent', async () => {
    const found = await inRepositories({
      run: async ({ wake }) => [await wake.findWake({ agent: 'nobody' }), await wake.findPollState({ agent: 'nobody' })],
    });
    expect(found).toEqual([null, null]);
  });

  it('saves a scheduled wake without touching the poll columns', async () => {
    const result = await inRepositories({
      run: async ({ wake, storage }) => {
        await wake.saveWake({ wake: scheduledWake({ agent: SCHEDULED_AGENT }) });
        return { stored: await wake.findWake({ agent: SCHEDULED_AGENT }), row: readAgentWakeRow({ storage, agent: SCHEDULED_AGENT }) };
      },
    });
    expect(result.stored).toEqual(scheduledWake({ agent: SCHEDULED_AGENT }));
    expect(result.row).toMatchObject({
      interval_minutes: SCHEDULED_INTERVAL_MINUTES,
      standby_agent: null,
      owner_locale: OwnerLocale.PortugueseBrazil,
      last_polled_at: BASE_TIME,
      has_polled: 0,
      poller_stale_notified: 0,
    });
  });

  it('saves a standby wake', async () => {
    const result = await inRepositories({
      run: async ({ wake, storage }) => {
        await wake.saveWake({ wake: storedWake({ agent: SCHEDULED_AGENT, mode: WakeMode.Standby, standbyAgent: STANDBY_AGENT }) });
        return readAgentWakeRow({ storage, agent: SCHEDULED_AGENT });
      },
    });
    expect(result).toMatchObject({ mode: WakeMode.Standby, standby_agent: STANDBY_AGENT, interval_minutes: null });
  });

  it('clears the interval and the standby when the mode returns to none', async () => {
    const result = await inRepositories({
      run: async ({ wake, storage }) => {
        await wake.saveWake({ wake: scheduledWake({ agent: SCHEDULED_AGENT }) });
        await wake.saveWake({ wake: storedWake({ agent: SCHEDULED_AGENT }) });
        return readAgentWakeRow({ storage, agent: SCHEDULED_AGENT });
      },
    });
    expect(result).toMatchObject({ mode: WakeMode.None, interval_minutes: null, standby_agent: null });
  });

  it('throws naming the column when a scheduled row has no interval', async () => {
    const reading = inRepositories({
      run: async ({ wake, storage }) => {
        storage.sql.exec("UPDATE agent_wake SET mode = 'scheduled', owner_locale = 'pt_BR' WHERE agent = ?", SCHEDULED_AGENT);
        return wake.findWake({ agent: SCHEDULED_AGENT });
      },
    });
    await expect(reading).rejects.toThrow(/interval_minutes/);
  });

  it('throws naming the column when a scheduled row has no locale', async () => {
    const reading = inRepositories({
      run: async ({ wake, storage }) => {
        storage.sql.exec("UPDATE agent_wake SET mode = 'scheduled', interval_minutes = 60 WHERE agent = ?", SCHEDULED_AGENT);
        return wake.findWake({ agent: SCHEDULED_AGENT });
      },
    });
    await expect(reading).rejects.toThrow(/owner_locale/);
  });

  it('throws naming the column when a standby row has no standby agent', async () => {
    const reading = inRepositories({
      run: async ({ wake, storage }) => {
        storage.sql.exec("UPDATE agent_wake SET mode = 'standby' WHERE agent = ?", SCHEDULED_AGENT);
        return wake.findWake({ agent: SCHEDULED_AGENT });
      },
    });
    await expect(reading).rejects.toThrow(/standby_agent/);
  });
});

describe('poll state', () => {
  it('records a poll', async () => {
    const result = await inRepositories({
      run: async ({ wake, storage }) => {
        await wake.markStaleNotified({ agent: SCHEDULED_AGENT, noticedAt: NOTICED_AT });
        await wake.recordPoll({ agent: SCHEDULED_AGENT, polledAt: POLLED_AT, ownerLocale: OwnerLocale.PortugueseBrazil });
        return { row: readAgentWakeRow({ storage, agent: SCHEDULED_AGENT }), state: await wake.findPollState({ agent: SCHEDULED_AGENT }) };
      },
    });
    expect(result.row).toMatchObject({
      last_polled_at: POLLED_AT,
      has_polled: 1,
      owner_locale: OwnerLocale.PortugueseBrazil,
      poller_stale_notified: 0,
    });
    expect(result.state).toEqual({
      lastPolledAt: POLLED_AT,
      hasPolled: true,
      pollerStaleNotified: false,
      lastStaleNoticeAt: NOTICED_AT,
      staleNoticeFailures: 0,
    });
  });

  it('leaves the mode and the target alone and survives a later save', async () => {
    const result = await inRepositories({
      run: async ({ wake, storage }) => {
        storage.sql.exec(
          "UPDATE agent_wake SET mode = 'webhook', provider = 'grok', host = 'h', sealed_target = 's', key_version = 1 WHERE agent = ?",
          SCHEDULED_AGENT,
        );
        await wake.recordPoll({ agent: SCHEDULED_AGENT, polledAt: POLLED_AT, ownerLocale: OwnerLocale.EnglishUs });
        const afterPoll = readAgentWakeRow({ storage, agent: SCHEDULED_AGENT });
        await wake.saveWake({ wake: storedWake({ agent: SCHEDULED_AGENT }) });
        return { afterPoll, afterSave: readAgentWakeRow({ storage, agent: SCHEDULED_AGENT }) };
      },
    });
    expect(result.afterPoll).toMatchObject({ mode: WakeMode.Webhook, provider: 'grok', sealed_target: 's' });
    expect(result.afterSave).toMatchObject({ last_polled_at: POLLED_AT, has_polled: 1 });
  });

  it('keeps the recorded locale when a save carries none', async () => {
    const row = await inRepositories({
      run: async ({ wake, storage }) => {
        await wake.recordPoll({ agent: SCHEDULED_AGENT, polledAt: POLLED_AT, ownerLocale: OwnerLocale.EnglishUs });
        await wake.saveWake({ wake: storedWake({ agent: SCHEDULED_AGENT }) });
        return readAgentWakeRow({ storage, agent: SCHEDULED_AGENT });
      },
    });
    expect(row).toMatchObject({ owner_locale: OwnerLocale.EnglishUs });
  });

  it('throws without creating a row when the agent has none', async () => {
    const recording = inRepositories({
      run: async ({ wake, storage }) => {
        const failure = await wake.recordPoll({ agent: 'nobody', polledAt: POLLED_AT, ownerLocale: OwnerLocale.EnglishUs }).then(
          () => null,
          (error: Error) => error,
        );
        const rows = storage.sql.exec("SELECT agent FROM agent_wake WHERE agent = 'nobody'").toArray();
        return { failure, rows };
      },
    });
    const { failure, rows } = await recording;
    expect(failure).toBeInstanceOf(Error);
    expect(rows).toEqual([]);
  });

  it('counts failed stale notices and a poll or a delivery resets the count', async () => {
    const failed = await inRepositories({
      run: async ({ wake }) => {
        await wake.recordStaleNoticeFailure({ agent: SCHEDULED_AGENT, failedAt: NOTICED_AT });
        await wake.recordStaleNoticeFailure({ agent: SCHEDULED_AGENT, failedAt: NOTICED_AT });
        const twice = await wake.findPollState({ agent: SCHEDULED_AGENT });
        await wake.recordPoll({ agent: SCHEDULED_AGENT, polledAt: POLLED_AT, ownerLocale: OwnerLocale.PortugueseBrazil });
        return { twice, afterPoll: await wake.findPollState({ agent: SCHEDULED_AGENT }) };
      },
    });
    expect(failed.twice).toMatchObject({ lastStaleNoticeAt: NOTICED_AT, staleNoticeFailures: 2, pollerStaleNotified: false });
    expect(failed.afterPoll).toMatchObject({ staleNoticeFailures: 0 });
  });

  it('keeps the stale mark after the object restarts', async () => {
    await inRepositories({ run: ({ wake }) => wake.markStaleNotified({ agent: SCHEDULED_AGENT, noticedAt: NOTICED_AT }) });
    const state = await inRepositories({ run: ({ wake }) => wake.findPollState({ agent: SCHEDULED_AGENT }) });
    expect(state).toMatchObject({ pollerStaleNotified: true, lastStaleNoticeAt: NOTICED_AT });
  });

  it('lists the scheduled wakes with their poll state', async () => {
    const wakes = await inRepositories({
      agents: [SCHEDULED_AGENT, OTHER_SCHEDULED_AGENT, WEBHOOK_AGENT],
      run: async ({ wake, storage }) => {
        await wake.saveWake({ wake: scheduledWake({ agent: SCHEDULED_AGENT }) });
        await wake.saveWake({ wake: scheduledWake({ agent: OTHER_SCHEDULED_AGENT }) });
        storage.sql.exec("UPDATE agent_wake SET mode = 'webhook' WHERE agent = ?", WEBHOOK_AGENT);
        await wake.recordPoll({ agent: SCHEDULED_AGENT, polledAt: POLLED_AT, ownerLocale: OwnerLocale.PortugueseBrazil });
        return wake.listScheduledWakes();
      },
    });
    expect(wakes.map((entry) => entry.agent)).toEqual([SCHEDULED_AGENT, OTHER_SCHEDULED_AGENT]);
    expect(wakes[0]).toMatchObject({ lastPolledAt: POLLED_AT, hasPolled: true, pollerStaleNotified: false, intervalMinutes: 60 });
    expect(wakes[1]).toMatchObject({ lastPolledAt: BASE_TIME, hasPolled: false });
  });

  it('lists nothing for an agent whose wake row was deleted', async () => {
    const wakes = await inRepositories({
      run: async ({ wake, storage }) => {
        await wake.saveWake({ wake: scheduledWake({ agent: SCHEDULED_AGENT }) });
        storage.sql.exec('DELETE FROM agent_wake WHERE agent = ?', SCHEDULED_AGENT);
        return wake.listScheduledWakes();
      },
    });
    expect(wakes).toEqual([]);
  });
});

describe('handoff', () => {
  it('marks the primary message read and stores the copy for the standby', async () => {
    const result = await inRepositories({
      agents: [STANDBY_AGENT, 'grok-web-primary'],
      run: async ({ inbox, storage }) => {
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm1', agent: 'grok-web-primary' }) });
        const copy = { ...ownerMessage({ messageId: 'c1', agent: STANDBY_AGENT }), originMessageId: 'm1' };
        await inbox.insertHandoff({ copy, primaryAgent: 'grok-web-primary', handedTo: STANDBY_AGENT });
        return {
          primary: readMessageRow({ storage, messageId: 'm1' }),
          copyRow: readMessageRow({ storage, messageId: 'c1' }),
          found: await inbox.findMessage({ messageId: 'c1' }),
          primaryMessage: await inbox.findMessage({ messageId: 'm1' }),
        };
      },
    });
    expect(result.primary).toMatchObject({ handed_to: STANDBY_AGENT });
    expect(result.primary.read_at).not.toBeNull();
    expect(result.copyRow).toMatchObject({ agent: STANDBY_AGENT, origin_message_id: 'm1', read_at: null });
    expect(result.found).toMatchObject({ agent: STANDBY_AGENT, originMessageId: 'm1', handedTo: null });
    expect(result.primaryMessage).toMatchObject({ handedTo: STANDBY_AGENT, readByAgent: true });
  });

  it('rolls the copy back when the primary update fails', async () => {
    const result = await inRepositories({
      agents: [STANDBY_AGENT, 'grok-web-primary'],
      run: async ({ inbox, storage }) => {
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm1', agent: 'grok-web-primary' }) });
        storage.sql.exec("CREATE TRIGGER block_update BEFORE UPDATE ON inbox_messages BEGIN SELECT RAISE(ABORT, 'blocked'); END");
        const copy = { ...ownerMessage({ messageId: 'c1', agent: STANDBY_AGENT }), originMessageId: 'm1' };
        const failure = await inbox.insertHandoff({ copy, primaryAgent: 'grok-web-primary', handedTo: STANDBY_AGENT }).then(
          () => null,
          (error: Error) => error,
        );
        return { failure, copies: storage.sql.exec("SELECT id FROM inbox_messages WHERE id = 'c1'").toArray() };
      },
    });
    expect(result.failure).toBeInstanceOf(Error);
    expect(result.copies).toEqual([]);
  });
});

describe('unread count', () => {
  it('counts through the partial index', async () => {
    const plan = await inRepositories({
      run: async ({ storage }) =>
        storage.sql
          .exec<{ detail: string }>(
            'EXPLAIN QUERY PLAN SELECT COUNT(*) FROM inbox_messages WHERE agent = ? AND direction = ? AND read_at IS NULL',
            'alpha',
            MessageDirection.FromOwner,
          )
          .toArray()
          .map((row) => row.detail)
          .join(' '),
    });
    expect(plan).toContain('inbox_messages_unread');
  });

  it('counts zero without rows', async () => {
    expect(await inRepositories({ run: ({ inbox }) => inbox.countUnread({ agent: 'alpha' }) })).toBe(0);
  });

  it('ignores read rows', async () => {
    const unread = await inRepositories({
      run: async ({ inbox }) => {
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm1', agent: 'alpha', readByAgent: true }) });
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm2', agent: 'alpha', readByAgent: true }) });
        await inbox.insertMessage({ message: ownerMessage({ messageId: 'm3', agent: 'alpha' }) });
        return inbox.countUnread({ agent: 'alpha' });
      },
    });
    expect(unread).toBe(1);
  });
});
