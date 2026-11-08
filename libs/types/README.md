# @zapbip/types

The vocabulary every other package shares: the enums that name message kinds, directions, delivery states, routing rules and error codes, the connector and channel-plugin contracts, and the time and size constants. It holds no logic and no runtime dependency, so [the rules](../core), [the agents](../agents) and [the Worker](../../apps/api) take every shared name from one place.
