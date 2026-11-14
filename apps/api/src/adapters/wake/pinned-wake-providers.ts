import { WAKE_TARGETS } from '@zapbip/agents/wake';
import type { PinnedWakeProviderRule } from '@zapbip/core';

export const PINNED_WAKE_PROVIDERS: PinnedWakeProviderRule[] = Object.values(WAKE_TARGETS);
