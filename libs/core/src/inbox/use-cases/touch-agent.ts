import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';

export async function touchAgent(input: { dependencies: CoreDependencies; agent: AgentName }): Promise<void> {
  const { repository, clock } = input.dependencies;
  const registered = await repository.listAgents();
  await repository.registerAgent({ agent: input.agent, seenAt: clock.now() });
  if (registered.length > 0) return;
  const held = await repository.listHeld();
  await repository.assignAgent({ messageIds: held.map((message) => message.messageId), agent: input.agent });
}
