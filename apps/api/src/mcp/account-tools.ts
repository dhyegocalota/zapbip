import { AgentChangeStatus, AccountReplyIntent, CommandKind } from '@zapbip/types';
import type { z } from 'zod';
import { toOverviewWire, type AccountOverviewWire } from '../accounts/overview-wire';
import type { connectAgentInputShape, revokeAgentInputShape } from '../contract/mcp-schemas';
import { unwrapOutcome } from './tool-error';
import type { ToolContext, ToolSuccess } from './types';

type NameArguments = z.infer<z.ZodObject<typeof connectAgentInputShape | typeof revokeAgentInputShape>>;
type ChangeKind = CommandKind.CreateAgent | CommandKind.RevokeAgent;

async function describeAccount(input: { context: ToolContext }): Promise<AccountOverviewWire> {
  const outcome = await input.context.accountInbox.describeAccount({ connection: input.context.connection });
  return toOverviewWire({ overview: unwrapOutcome({ outcome }) });
}

function changeSuccess(input: {
  status: AgentChangeStatus;
  agent: string | null;
  intent: AccountReplyIntent | null;
  installPrompt: string | null;
}): ToolSuccess {
  const { status, agent, intent, installPrompt } = input;
  const reason = status === AgentChangeStatus.Refused ? intent : null;
  return { structured: { status, agent, reason, install_prompt: installPrompt }, images: [] };
}

async function requestChange(input: { context: ToolContext; kind: ChangeKind; rawName: string }): Promise<ToolSuccess> {
  const { context, kind, rawName } = input;
  const outcome = await context.accountInbox.requestAccountChange({ connection: context.connection, kind, rawName });
  return changeSuccess(unwrapOutcome({ outcome }));
}

export async function listAgents(input: { context: ToolContext }): Promise<ToolSuccess> {
  const { agents } = await describeAccount(input);
  return { structured: { agents }, images: [] };
}

export async function accountStatus(input: { context: ToolContext }): Promise<ToolSuccess> {
  const { state, plan, free_messages: freeMessages } = await describeAccount(input);
  return { structured: { state, plan, free_messages: freeMessages }, images: [] };
}

export function connectAgent(input: { context: ToolContext; arguments: NameArguments }): Promise<ToolSuccess> {
  return requestChange({ context: input.context, kind: CommandKind.CreateAgent, rawName: input.arguments.name });
}

export function revokeAgent(input: { context: ToolContext; arguments: NameArguments }): Promise<ToolSuccess> {
  return requestChange({ context: input.context, kind: CommandKind.RevokeAgent, rawName: input.arguments.name });
}

export async function signInLink(input: { context: ToolContext }): Promise<ToolSuccess> {
  const { context } = input;
  const outcome = await context.accountInbox.sendSignInLink({ connection: context.connection });
  const { intent } = unwrapOutcome({ outcome });
  const status = intent === AccountReplyIntent.SignInLink ? AgentChangeStatus.Applied : AgentChangeStatus.Refused;
  return changeSuccess({ status, agent: null, intent, installPrompt: null });
}
