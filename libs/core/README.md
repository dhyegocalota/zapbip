# @zapbip/core

The rules of the agent inbox as plain TypeScript: validation, owner routing, the 24-hour window, questions and answers, media bookkeeping, the webhook wake of a sleeping agent and the owner-facing copy. It reaches the outside world only through ports, which the [Worker](../../apps/api) implements and the tests replace, and it takes its vocabulary from [the shared types](../types).
