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
  WakeSuccess = 'wake-success',
  BudgetUsed = 'budget-used',
  BlockedPhones = 'blocked-phones',
  Restricted = 'restricted',
}

export const NOT_REPORTED_CLIENT_KEY = 'not-reported';

export function keyedCell(input: { cell: MetricCell; key: string }): string {
  return `${input.cell}:${input.key}`;
}
