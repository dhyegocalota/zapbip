import { describe, expect, test } from 'vitest';
import { ownerTextEntry, receiveChannel } from '../testing/channel-fixtures';
import { createEnvironment } from '../testing/fixtures';
import { hasChannelReceipt } from './has-channel-receipt';

const WAMID = 'wamid.RECEIPT';

describe('hasChannelReceipt', () => {
  test('is false before the channel message commits and true after', async () => {
    const environment = await createEnvironment();
    const dependencies = environment.dependencies;
    expect(await hasChannelReceipt({ dependencies, channelMessageId: WAMID })).toBe(false);
    await receiveChannel({ environment, channelMessageId: WAMID, entry: ownerTextEntry({ environment, text: 'oi' }) });
    expect(await hasChannelReceipt({ dependencies, channelMessageId: WAMID })).toBe(true);
  });
});
