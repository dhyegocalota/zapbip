import type { AccountOverview } from '@zapbip/core';
import type { z } from 'zod';
import type { accountOverviewWireSchema } from '../contract/mcp-schemas';
import { toIsoTimestamp } from '../mcp/wire';

export type AccountOverviewWire = z.infer<typeof accountOverviewWireSchema>;

export function toOverviewWire(input: { overview: AccountOverview }): AccountOverviewWire {
  const { state, phone, plan, freeMessages, agents } = input.overview;
  return {
    state,
    phone,
    plan,
    free_messages: freeMessages,
    agents: agents.map((summary) => ({
      name: summary.agent,
      client: summary.clientName,
      created_at: toIsoTimestamp({ epochMs: summary.createdAt }),
      last_active_at: summary.lastSeenAt === null ? null : toIsoTimestamp({ epochMs: summary.lastSeenAt }),
    })),
  };
}
