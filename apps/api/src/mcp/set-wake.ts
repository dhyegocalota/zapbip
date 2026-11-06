import { InboxError } from '@zapbip/core';
import { InboxErrorCode, WakeMode } from '@zapbip/types';
import type { z } from 'zod';
import { type setWakeToolInputSchema, type UnavailableWakeMode } from '../contract/mcp-schemas';
import { unwrapOutcome } from './tool-error';
import type { ToolContext, ToolSuccess } from './types';

const WAKE_MODE_UNAVAILABLE_MESSAGE = 'wake mode not available yet';

function isAvailableWakeMode(mode: WakeMode | UnavailableWakeMode): mode is WakeMode {
  return Object.values<string>(WakeMode).includes(mode);
}

export async function setWake(input: { context: ToolContext; arguments: z.infer<typeof setWakeToolInputSchema> }): Promise<ToolSuccess> {
  const { context, arguments: toolArguments } = input;
  const { mode, url, token, interval_minutes: intervalMinutes, standby_agent: standbyAgent } = toolArguments;
  if (!isAvailableWakeMode(mode)) throw new InboxError({ code: InboxErrorCode.InvalidInput, message: WAKE_MODE_UNAVAILABLE_MESSAGE });
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
