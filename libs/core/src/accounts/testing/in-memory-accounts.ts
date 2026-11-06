import { AccountState, OwnerLocale, RegisterOutcome } from '@zapbip/types';
import type { AgentName, ConnectionIdentity } from '../../inbox/connection';
import type { ConnectionDirectory } from '../../inbox/ports';
import { createInMemoryDependencies, type InMemoryEnvironment, type InMemoryOptions } from '../../inbox/testing/in-memory';
import type { AccountLookup, AccountRecord, ConnectionRecord, IssuedSecret, OwnerAccountContext } from '../account-types';
import type {
  AccountDependencies,
  AccountDirectory,
  AccountLifecycleDependencies,
  AccountMediaPurge,
  ConnectionRegistry,
  ConnectionRevocations,
  ConnectionSecrets,
  DeletionRequests,
  FirstMessageClaim,
  InstallPromptRenderer,
} from '../ports';

const FAKE_SECRET_PREFIX = 'zb_conn_fake_';
const FAKE_DIGEST_PREFIX = 'fake:';
const DEFAULT_WA_ID = '5511999990000';

type StoredAccount = AccountRecord & { createdAt: number };
type StoredConnection = { record: ConnectionRecord; revokedAt: number | null };

export type RecordingSecrets = ConnectionSecrets & { issued: IssuedSecret[] };
export type RecordingRevocations = ConnectionRevocations & {
  revoked: AgentName[];
  cancelled: AgentName[];
  wakeConfigured: Set<AgentName>;
};
export type InMemoryAccountMedia = AccountMediaPurge & {
  put(input: { accountId: string; mediaId: string }): void;
  count(input: { accountId: string }): number;
};
export type InMemoryConnections = ConnectionRegistry & {
  listAll(input: { accountId: string }): StoredConnection[];
  countAccounts(): number;
};

export type InMemoryAccountEnvironment = Omit<InMemoryEnvironment, 'dependencies'> & {
  dependencies: AccountDependencies;
  lifecycle: AccountLifecycleDependencies;
  directory: AccountDirectory;
  registry: InMemoryConnections;
  connectionDirectory: ConnectionDirectory;
  secrets: RecordingSecrets;
  revocations: RecordingRevocations;
  accountMedia: InMemoryAccountMedia;
  openAccount(input?: { waId?: string; state?: AccountState; locale?: OwnerLocale; accountId?: string }): Promise<OwnerAccountContext>;
};

type AccountStore = {
  accounts: Map<string, StoredAccount>;
  identities: Map<string, string>;
  connections: Map<string, StoredConnection>;
};

function createDirectory(input: { store: AccountStore }): AccountDirectory {
  const { accounts, identities, connections } = input.store;
  const toRecord = ({ accountId, waId, state, locale }: StoredAccount): AccountRecord => ({ accountId, waId, state, locale });

  return {
    findByWaId: async ({ waId }) => {
      const accountId = identities.get(waId);
      if (accountId === undefined) return null;
      const stored = accounts.get(accountId);
      return stored === undefined ? null : toRecord(stored);
    },
    findOrCreateByWaId: async ({ waId, accountId, initialState, locale, createdAt, newAccountsCap }): Promise<AccountLookup | null> => {
      const existingId = identities.get(waId);
      const existing = existingId === undefined ? undefined : accounts.get(existingId);
      if (existing !== undefined) return { account: toRecord(existing), created: false };
      const recentlyCreated = [...accounts.values()].filter((stored) => stored.createdAt > newAccountsCap.since).length;
      if (recentlyCreated >= newAccountsCap.limit) return null;
      const stored: StoredAccount = { accountId, waId, state: initialState, locale, createdAt };
      accounts.set(accountId, stored);
      identities.set(waId, accountId);
      return { account: toRecord(stored), created: true };
    },
    setState: async ({ accountId, state }) => {
      const stored = accounts.get(accountId);
      if (stored === undefined) return;
      accounts.set(accountId, { ...stored, state });
    },
    listByState: async ({ state }) => [...accounts.values()].filter((stored) => stored.state === state).map(toRecord),
    remove: async ({ accountId }) => {
      const stored = accounts.get(accountId);
      if (stored === undefined) return;
      accounts.delete(accountId);
      identities.delete(stored.waId);
      [...connections]
        .filter(([, row]) => row.record.accountId === accountId)
        .forEach(([connectionId]) => connections.delete(connectionId));
    },
  };
}

function createRegistry(input: { store: AccountStore }): InMemoryConnections {
  const { accounts, connections } = input.store;
  const activeOf = (accountId: string): StoredConnection[] =>
    [...connections.values()].filter((row) => row.record.accountId === accountId && row.revokedAt === null);
  const findActive = (lookup: { accountId: string; agent: AgentName }): StoredConnection | undefined =>
    activeOf(lookup.accountId).find((row) => row.record.agent === lookup.agent);

  return {
    listAll: ({ accountId }) => [...connections.values()].filter((row) => row.record.accountId === accountId),
    countAccounts: () => accounts.size,
    register: async ({ connection, activeLimit }) => {
      if (findActive(connection) !== undefined) return RegisterOutcome.NameTaken;
      if (activeOf(connection.accountId).length >= activeLimit) return RegisterOutcome.LimitReached;
      connections.set(connection.connectionId, { record: connection, revokedAt: null });
      return RegisterOutcome.Registered;
    },
    findActiveByAgent: async (lookup) => {
      const found = findActive(lookup);
      return found === undefined ? null : found.record;
    },
    listActive: async ({ accountId }) => activeOf(accountId).map((row) => row.record),
    revoke: async ({ accountId, agent, revokedAt }) => {
      const found = findActive({ accountId, agent });
      if (found === undefined) return false;
      connections.set(found.record.connectionId, { ...found, revokedAt });
      return true;
    },
    rotate: async ({ accountId, agent, fromDigest, toDigest }) => {
      const found = findActive({ accountId, agent });
      if (found === undefined || found.record.secretDigest !== fromDigest) return false;
      connections.set(found.record.connectionId, { ...found, record: { ...found.record, secretDigest: toDigest } });
      return true;
    },
  };
}

function createConnectionDirectory(input: { store: AccountStore }): ConnectionDirectory {
  const { accounts, connections } = input.store;
  return {
    resolveSecretDigest: async ({ secretDigest }): Promise<ConnectionIdentity | null> => {
      const found = [...connections.values()].find((row) => row.record.secretDigest === secretDigest && row.revokedAt === null);
      if (found === undefined) return null;
      const account = accounts.get(found.record.accountId);
      if (account === undefined || account.state !== AccountState.Active) return null;
      return { accountId: account.accountId, agent: found.record.agent, ownerLocale: account.locale };
    },
  };
}

function createSecrets(): RecordingSecrets {
  const issued: IssuedSecret[] = [];
  return {
    issued,
    issue: async () => {
      const secret = `${FAKE_SECRET_PREFIX}${issued.length + 1}`;
      const next = { secret, digest: `${FAKE_DIGEST_PREFIX}${secret}` };
      issued.push(next);
      return next;
    },
  };
}

function createRevocations(input: { environment: InMemoryEnvironment }): RecordingRevocations {
  const { waiters } = input.environment.dependencies;
  const revoked: AgentName[] = [];
  const cancelled: AgentName[] = [];
  const wakeConfigured = new Set<AgentName>();
  return {
    revoked,
    cancelled,
    wakeConfigured,
    recordRevocation: async ({ agent }) => {
      revoked.push(agent);
      wakeConfigured.delete(agent);
      waiters.resolveAgentMessage({ agent });
    },
    cancelWaiters: async ({ agent }) => {
      cancelled.push(agent);
      waiters.resolveAgentMessage({ agent });
    },
  };
}

function createAccountMedia(): InMemoryAccountMedia {
  const objects = new Map<string, Set<string>>();

  function objectsOf(input: { accountId: string }): Set<string> {
    const existing = objects.get(input.accountId);
    if (existing !== undefined) return existing;
    const created = new Set<string>();
    objects.set(input.accountId, created);
    return created;
  }

  return {
    put: ({ accountId, mediaId }) => {
      objectsOf({ accountId }).add(mediaId);
    },
    count: ({ accountId }) => objectsOf({ accountId }).size,
    deleteAll: async ({ accountId }) => {
      objects.delete(accountId);
    },
  };
}

function createFirstMessageClaim(): FirstMessageClaim {
  let firstChannelMessageId: string | null = null;
  return {
    claim: async ({ channelMessageId }) => {
      if (firstChannelMessageId === null) firstChannelMessageId = channelMessageId;
      return firstChannelMessageId === channelMessageId;
    },
  };
}

function createDeletionRequests(): DeletionRequests {
  let requestedAt: number | null = null;
  return {
    save: async (input) => {
      requestedAt = input.requestedAt;
    },
    find: async () => requestedAt,
    clear: async () => {
      requestedAt = null;
    },
  };
}

function createInstallPromptRenderer(): InstallPromptRenderer {
  return {
    render: async ({ agent, connectionLink }) => `Install ${agent}\nConnect it with this link\n${connectionLink}`,
  };
}

export function createInMemoryAccountDependencies(input: InMemoryOptions = {}): InMemoryAccountEnvironment {
  const environment = createInMemoryDependencies(input);
  const store: AccountStore = { accounts: new Map(), identities: new Map(), connections: new Map() };
  const directory = createDirectory({ store });
  const accountMedia = createAccountMedia();
  const secrets = createSecrets();
  const revocations = createRevocations({ environment });
  const registry = createRegistry({ store });
  const dependencies: AccountDependencies = {
    ...environment.dependencies,
    accounts: directory,
    connections: registry,
    connectionSecrets: secrets,
    installPromptRenderer: createInstallPromptRenderer(),
    revocations,
    firstMessage: createFirstMessageClaim(),
    deletionRequests: createDeletionRequests(),
  };

  async function openAccount(options: { waId?: string; state?: AccountState; locale?: OwnerLocale; accountId?: string } = {}) {
    const {
      waId = DEFAULT_WA_ID,
      state = AccountState.Active,
      locale = OwnerLocale.PortugueseBrazil,
      accountId = dependencies.accountId,
    } = options;
    const createdAt = environment.clock.now();
    const lookup = await directory.findOrCreateByWaId({
      waId,
      accountId,
      initialState: state,
      locale,
      createdAt,
      newAccountsCap: { since: 0, limit: Number.MAX_SAFE_INTEGER },
    });
    if (lookup === null) throw new Error('the in-memory directory refused the account');
    return lookup.account;
  }

  return {
    ...environment,
    dependencies,
    lifecycle: { accounts: directory, accountMedia, ids: dependencies.ids },
    directory,
    registry,
    connectionDirectory: createConnectionDirectory({ store }),
    secrets,
    revocations,
    accountMedia,
    openAccount,
  };
}
