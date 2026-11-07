import type { CheckInboxInput, CheckInboxResult } from '../inbox/use-cases/types';
import { readInbox } from '../inbox/use-cases/check-inbox';
import { touchAgent } from '../inbox/use-cases/touch-agent';
import type { WakeContext } from './wake-ports';

export async function pollInbox(input: CheckInboxInput & Pick<WakeContext, 'wake'>): Promise<CheckInboxResult> {
  const { dependencies, connection, wake } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  await wake.repository.recordPoll({ agent: connection.agent, polledAt: dependencies.clock.now(), ownerLocale: connection.ownerLocale });
  return readInbox({ dependencies, agent: connection.agent });
}
