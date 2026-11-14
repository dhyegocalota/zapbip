import type { AgentChannelProtocol } from '@zapbip/agents/channel';
import { describe, expect, it } from 'vitest';
import { CHANNEL_PROTOCOL, soleChannelProtocolOf } from '../../src/channel-protocol';

const FIRST: AgentChannelProtocol = { capability: 'first/channel', notificationMethod: 'notifications/first/channel' };
const SECOND: AgentChannelProtocol = { capability: 'second/channel', notificationMethod: 'notifications/second/channel' };

describe('the channel protocol of the connector', () => {
  it('is the one protocol a supported agent declares', () => {
    expect(CHANNEL_PROTOCOL.capability.length).toBeGreaterThan(0);
    expect(CHANNEL_PROTOCOL.notificationMethod).toContain(CHANNEL_PROTOCOL.capability.split('/')[0]);
  });

  it('returns the only protocol of a list of one', () => {
    expect(soleChannelProtocolOf({ protocols: [FIRST] })).toBe(FIRST);
  });

  it('refuses a registry with no protocol', () => {
    expect(() => soleChannelProtocolOf({ protocols: [] })).toThrow('no supported agent declares a channel protocol');
  });

  it('refuses a registry with two protocols instead of choosing one', () => {
    expect(() => soleChannelProtocolOf({ protocols: [FIRST, SECOND] })).toThrow('more than one supported agent');
  });
});
