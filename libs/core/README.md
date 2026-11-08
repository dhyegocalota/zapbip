# @zapbip/core

The rules of the agent inbox as plain TypeScript: validation, owner routing, the account lifecycle and its commands, the 24-hour window, questions and answers, media bookkeeping, the webhook wake of a sleeping agent and the owner-facing copy. It renders the install page from the sections it is given and names no agent. It reaches the outside world only through ports, which the [Worker](../../apps/api) implements and the tests replace, and it takes its vocabulary from [the shared types](../types).
