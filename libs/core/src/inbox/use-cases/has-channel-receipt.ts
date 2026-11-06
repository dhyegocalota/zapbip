import type { HasChannelReceiptInput } from './types';

export function hasChannelReceipt(input: HasChannelReceiptInput): Promise<boolean> {
  return input.dependencies.repository.hasChannelReceipt({ wamid: input.channelMessageId });
}
