import { AccountReplyIntent, AgentChangeStatus, AgentCommandRecipient, CommandKind, IdPrefix, ReplyStatus } from '@zapbip/types';
import type { AgentName } from '../../inbox/connection';
import { ask } from '../../inbox/use-cases/ask';
import { approvalTitlesOf, renderApprovalQuestion, ApprovalChoice } from '../agent-approval-copy';
import { APPROVAL_COOLDOWN_MS, APPROVAL_REFERENCE_LENGTH } from '../constants';
import { applyAgentCommand } from './apply-agent-command';
import { checkExistingAgent, checkNewAgentName, type ExistingAgentCheck, type NewAgentNameCheck } from './check-agent-name';
import type { AgentChangeResult, ApprovedCommandKind, RequestAccountChangeInput } from './types';

const COOLDOWN_KEY_SEPARATOR = ':';
const APPLIED_INTENTS: ReadonlySet<AccountReplyIntent> = new Set([AccountReplyIntent.Created, AccountReplyIntent.Revoked]);

const APPROVAL_CHOICES: Record<ApprovedCommandKind, ApprovalChoice[]> = {
  [CommandKind.CreateAgent]: [ApprovalChoice.Allow, ApprovalChoice.AllowAndSend, ApprovalChoice.Deny],
  [CommandKind.RevokeAgent]: [ApprovalChoice.Allow, ApprovalChoice.Deny],
};

function withoutChange(input: {
  status: AgentChangeStatus;
  agent: AgentName | null;
  intent: AccountReplyIntent | null;
}): AgentChangeResult {
  return { ...input, installPrompt: null };
}

async function checkName(input: RequestAccountChangeInput): Promise<NewAgentNameCheck | ExistingAgentCheck> {
  const { dependencies, connection, kind, rawName } = input;
  if (kind === CommandKind.CreateAgent) return checkNewAgentName({ rawName });
  return checkExistingAgent({ dependencies, accountId: connection.accountId, rawName });
}

async function askOwner(input: RequestAccountChangeInput & { agent: AgentName }): Promise<ApprovalChoice | null> {
  const { dependencies, connection, kind, agent, timeoutMs } = input;
  const titles = approvalTitlesOf({ locale: connection.ownerLocale });
  const choices = APPROVAL_CHOICES[kind];
  const reference = dependencies.ids.next({ prefix: IdPrefix.Question }).slice(-APPROVAL_REFERENCE_LENGTH);
  const reply = await ask({
    dependencies,
    connection,
    text: renderApprovalQuestion({ kind, locale: connection.ownerLocale, requester: connection.agent, agent, reference }),
    options: choices.map((choice) => titles[choice]),
    optionDescriptions: [],
    timeoutMs,
  });
  if (reply.status !== ReplyStatus.Answered) return null;
  const { optionIndex } = reply;
  if (optionIndex === null) return ApprovalChoice.Deny;
  const chosen = choices[optionIndex];
  return chosen === undefined ? ApprovalChoice.Deny : chosen;
}

function cooldownKeyOf(input: { requester: AgentName; kind: ApprovedCommandKind; agent: AgentName }): string {
  return [input.requester, input.kind, input.agent].join(COOLDOWN_KEY_SEPARATOR);
}

export async function requestAccountChange(input: RequestAccountChangeInput): Promise<AgentChangeResult> {
  const { dependencies, connection, kind, publicOrigin, appOrigin } = input;
  const { agent, refusal } = await checkName(input);
  if (refusal !== null) return withoutChange({ status: AgentChangeStatus.Refused, agent, intent: refusal });
  const cooldownKey = cooldownKeyOf({ requester: connection.agent, kind, agent });
  const isCoolingDown = await dependencies.approvalCooldowns.isCoolingDown({ key: cooldownKey, now: dependencies.clock.now() });
  if (isCoolingDown) return withoutChange({ status: AgentChangeStatus.Refused, agent, intent: AccountReplyIntent.CoolingDown });
  const choice = await askOwner({ ...input, agent });
  const isApproved = choice === ApprovalChoice.Allow || choice === ApprovalChoice.AllowAndSend;
  if (!isApproved) await dependencies.approvalCooldowns.start({ key: cooldownKey, until: dependencies.clock.now() + APPROVAL_COOLDOWN_MS });
  if (choice === null) return withoutChange({ status: AgentChangeStatus.TimedOut, agent, intent: null });
  if (choice === ApprovalChoice.Deny) return withoutChange({ status: AgentChangeStatus.Denied, agent, intent: null });
  const recipient = choice === ApprovalChoice.AllowAndSend ? AgentCommandRecipient.Agent : AgentCommandRecipient.Owner;
  const command = { kind, rawName: agent, locale: connection.ownerLocale };
  const { intent, installPrompt } = await applyAgentCommand({ dependencies, connection, publicOrigin, appOrigin, command, recipient });
  const status = APPLIED_INTENTS.has(intent) ? AgentChangeStatus.Applied : AgentChangeStatus.Refused;
  return { status, agent, intent, installPrompt };
}
