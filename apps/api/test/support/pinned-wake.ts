import { WAKE_TARGETS } from '@zapbip/agents/wake';

const [FIRST_RULE, SECOND_RULE] = Object.values(WAKE_TARGETS);
if (FIRST_RULE === undefined || SECOND_RULE === undefined) throw new Error('the registry needs two agents with a wake target');

export const FIRST_PINNED_RULE = FIRST_RULE;
export const SECOND_PINNED_RULE = SECOND_RULE;
export const FIRST_PINNED_PROVIDER = FIRST_RULE.providerId;
export const SECOND_PINNED_PROVIDER = SECOND_RULE.providerId;
export const FIRST_PINNED_HOST = FIRST_RULE.host;
export const FIRST_PINNED_URL = FIRST_RULE.exampleUrl;
export const SECOND_PINNED_URL = SECOND_RULE.exampleUrl;
