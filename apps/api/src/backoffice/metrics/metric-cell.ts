export enum MetricCell {
  Accounts = 'accounts',
  AccountState = 'account-state',
  NumberAccounts = 'number-accounts',
  NewAccounts = 'new-accounts',
  AgentsActive = 'agents-active',
  AgentsConnected = 'agents-connected',
  AgentClient = 'agent-client',
  AgentsCreated = 'agents-created',
  AgentsRevoked = 'agents-revoked',
  MessagesIn = 'messages-in',
  MessagesOut = 'messages-out',
  TemplatesNotice = 'templates-notice',
  TemplatesQuestion = 'templates-question',
  SendsFailed = 'sends-failed',
  WakesWoken = 'wakes-woken',
  WakeSuccess = 'wake-success',
  BudgetUsed = 'budget-used',
  BlockedPhones = 'blocked-phones',
  Restricted = 'restricted',
  AccessWaitlistTotal = 'access-waitlist-total',
  AccessWaitlistLocale = 'access-waitlist-locale',
  AccessInvitedTotal = 'access-invited-total',
  AccessInvitesUsedTotal = 'access-invites-used-total',
  AccessReleasedTotal = 'access-released-total',
  AccessReleasedConnectedTotal = 'access-released-connected-total',
  AccessJoins = 'access-joins',
  AccessInvited = 'access-invited',
  AccessInvitesUsed = 'access-invites-used',
  AccessReleased = 'access-released',
  AccessReleasedConnected = 'access-released-connected',
  AccessMessages = 'access-messages',
  AccessQuestions = 'access-questions',
}

export const NOT_REPORTED_CLIENT_KEY = 'not-reported';

export function keyedCell(input: { cell: MetricCell; key: string }): string {
  return `${input.cell}:${input.key}`;
}
