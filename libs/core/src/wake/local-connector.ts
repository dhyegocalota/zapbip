import { WakeMode } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { Message } from '../inbox/message';
import type { WakeContext } from './wake-ports';

export type AttachLocalConnectorInput = WakeContext & {
  agent: AgentName;
  limit: number;
};

export type AttachLocalConnectorResult = {
  previousWakeMode: WakeMode;
  unread: Message[];
};

export type DetachLocalConnectorInput = WakeContext & {
  agent: AgentName;
  remainingSockets: number;
};

export async function attachLocalConnector(input: AttachLocalConnectorInput): Promise<AttachLocalConnectorResult> {
  const { dependencies, wake, agent, limit } = input;
  const current = await wake.repository.findWake({ agent });
  if (current === null) throw new Error(`no wake setting for ${agent}`);
  const restore = await wake.repository.findLocalRestore({ agent });
  const isRestoreStale = restore !== null && current.mode !== WakeMode.Local;
  if (restore === null || isRestoreStale) await wake.repository.saveLocalRestore({ agent, previous: current });
  await wake.repository.saveWake({ wake: { ...current, mode: WakeMode.Local } });
  const unread = await dependencies.repository.listUnread({ agent, limit });
  return { previousWakeMode: current.mode, unread };
}

export async function detachLocalConnector(input: DetachLocalConnectorInput): Promise<void> {
  const { wake, agent, remainingSockets } = input;
  if (remainingSockets > 0) return;
  const restore = await wake.repository.findLocalRestore({ agent });
  if (restore === null) return;
  const current = await wake.repository.findWake({ agent });
  const isStillLocal = current !== null && current.mode === WakeMode.Local;
  if (isStillLocal) await wake.repository.saveWake({ wake: restore });
  await wake.repository.deleteLocalRestore({ agent });
}
