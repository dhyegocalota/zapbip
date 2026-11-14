import { CHANNEL_PROTOCOLS, type AgentChannelProtocol } from '@zapbip/agents/channel';

export function soleChannelProtocolOf(input: { protocols: AgentChannelProtocol[] }): AgentChannelProtocol {
  const [protocol, ...others] = input.protocols;
  if (protocol === undefined) throw new Error('no supported agent declares a channel protocol');
  if (others.length > 0)
    throw new Error('more than one supported agent declares a channel protocol; zapbip channel needs a --client choice');
  return protocol;
}

export const CHANNEL_PROTOCOL = soleChannelProtocolOf({ protocols: Object.values(CHANNEL_PROTOCOLS) });
