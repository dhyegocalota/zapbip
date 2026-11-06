import { applyStatusRule } from './status-rule';
import type { ApplyStatusInput, ApplyStatusResult } from './types';

export async function applyStatus(input: ApplyStatusInput): Promise<ApplyStatusResult> {
  const { dependencies, channelMessageId, status, detail } = input;
  const { repository } = dependencies;
  const message = await repository.findMessageByChannelMessageId({ channelMessageId });
  if (message === null || message.delivery === null) return { applied: false };
  const { next, logged } = applyStatusRule({ current: message.delivery, incoming: status });
  if (!logged) await repository.saveChannelStatusDetail({ messageId: message.messageId, detail });
  if (next !== null) await repository.updateDelivery({ messageId: message.messageId, delivery: next });
  return { applied: !logged };
}
