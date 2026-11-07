import type { z } from 'zod';
import type { setWakeInputSchema } from '../contract/mcp-schemas';
import { unwrapOutcome } from './tool-error';
import type { ToolContext, ToolSuccess } from './types';

export async function setWake(input: { context: ToolContext; arguments: z.infer<typeof setWakeInputSchema> }): Promise<ToolSuccess> {
  const { context, arguments: toolArguments } = input;
  const { mode, url, token, interval_minutes: intervalMinutes, standby_agent: standbyAgent } = toolArguments;
  const outcome = await context.accountInbox.setWake({
    connection: context.connection,
    setting: { mode, url, token, intervalMinutes, standbyAgent },
  });
  const saved = unwrapOutcome({ outcome });
  return {
    structured: { status: saved.status, wake_mode: saved.wakeMode, effective_rung: saved.effectiveRung, provider: saved.provider },
    images: [],
  };
}
