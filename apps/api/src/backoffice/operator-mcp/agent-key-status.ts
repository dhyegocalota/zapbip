import { BackofficeCopyKey } from '../backoffice-copy';
import { isOperatorKeyLive } from './operator-key';
import type { OperatorKeyRecord } from './operator-key-store';

export enum AgentKeyStatus {
  Active = 'active',
  Expired = 'expired',
  Revoked = 'revoked',
}

export const AGENT_KEY_STATUS_LABELS: Record<AgentKeyStatus, BackofficeCopyKey> = {
  [AgentKeyStatus.Active]: BackofficeCopyKey.AgentKeysStatusActive,
  [AgentKeyStatus.Expired]: BackofficeCopyKey.AgentKeysStatusExpired,
  [AgentKeyStatus.Revoked]: BackofficeCopyKey.AgentKeysStatusRevoked,
};

export function agentKeyStatusOf(input: { record: OperatorKeyRecord; now: number }): AgentKeyStatus {
  const { record, now } = input;
  if (record.revokedAt !== null) return AgentKeyStatus.Revoked;
  return isOperatorKeyLive({ expiresAt: record.expiresAt, revokedAt: record.revokedAt, now })
    ? AgentKeyStatus.Active
    : AgentKeyStatus.Expired;
}
