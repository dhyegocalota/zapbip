import type { ScreenEntry } from '../contract/account-inbox-rpc';
import type { SmokeFetch } from './smoke-checks';

export type SimulatorTarget = { origin: string; phone: string; fetchRequest: SmokeFetch };

export function postOwnerText(input: SimulatorTarget & { text: string }): Promise<void> {
  void input;
  throw new Error('postOwnerText is not implemented');
}

export function readOwnerScreen(input: SimulatorTarget): Promise<ScreenEntry[]> {
  void input;
  throw new Error('readOwnerScreen is not implemented');
}

export function mcpSecretOf(input: { entries: ScreenEntry[] }): string {
  void input;
  throw new Error('mcpSecretOf is not implemented');
}
