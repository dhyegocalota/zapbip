import { invalidInput } from '@zapbip/core';
import { WakeMode } from '@zapbip/types';
import { z } from 'zod';
import { UnavailableWakeMode, setWakeToolInputShape } from '../contract/mcp-schemas';
import { unwrapOutcome } from './tool-error';
import type { ToolContext, ToolSuccess } from './types';

const WAKE_MODE_UNAVAILABLE_MESSAGE = 'wake mode not available yet';

function isAvailableWakeMode(mode: WakeMode | UnavailableWakeMode): mode is WakeMode {
  return Object.values<string>(WakeMode).includes(mode);
}

export async function setWake(input: {
  context: ToolContext;
  arguments: z.infer<z.ZodObject<typeof setWakeToolInputShape>>;
}): Promise<ToolSuccess> {
  const { context, arguments: toolArguments } = input;
  const { mode, url, token } = toolArguments;
  if (!isAvailableWakeMode(mode)) throw invalidInput({ message: WAKE_MODE_UNAVAILABLE_MESSAGE });
  const outcome = await context.accountInbox.setWake({ connection: context.connection, setting: { mode, url, token } });
  const saved = unwrapOutcome({ outcome });
  return {
    structured: { status: saved.status, wake_mode: saved.wakeMode, effective_rung: saved.effectiveRung, provider: saved.provider },
    images: [],
  };
}
