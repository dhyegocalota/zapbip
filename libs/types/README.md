# @zapbip/types

The vocabulary every other package shares: the enums that name message kinds, directions, delivery states, routing rules and error codes, and the time and size constants. It holds no logic and no runtime dependency, so the [rules](../core) and the [Worker](../../apps/api) agree on every name without importing each other.
