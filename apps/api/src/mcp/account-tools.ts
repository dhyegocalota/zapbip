import type { ToolSuccess } from './types';

export async function listAgents(): Promise<ToolSuccess> {
  throw new Error('list_agents is not implemented');
}

export async function accountStatus(): Promise<ToolSuccess> {
  throw new Error('account_status is not implemented');
}

export async function connectAgent(): Promise<ToolSuccess> {
  throw new Error('connect_agent is not implemented');
}

export async function revokeAgent(): Promise<ToolSuccess> {
  throw new Error('revoke_agent is not implemented');
}

export async function signInLink(): Promise<ToolSuccess> {
  throw new Error('sign_in_link is not implemented');
}
