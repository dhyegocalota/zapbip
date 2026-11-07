import type {
  AgentName,
  ConnectionIdentity,
  RecordedWakeRequest,
  ScriptedWakeResponse,
  SetWakeResult,
  WakeSettingInput,
} from '@zapbip/core';
import type { CallOutcome } from './account-inbox-rpc';

export interface WakeRpc {
  setWake(input: { connection: ConnectionIdentity; setting: WakeSettingInput }): Promise<CallOutcome<SetWakeResult>>;
}

export interface DevWakeRpc {
  devScriptWake(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): Promise<void>;
  devReadWakeRequests(input: { agent: AgentName }): Promise<RecordedWakeRequest[]>;
  devRunDueWakes(): Promise<void>;
}
