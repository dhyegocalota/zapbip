# @zapbip/api

The Cloudflare Worker that serves the MCP tools to the owner's agents, keeps one Durable Object per account, indexes connections in D1, stores media in R2, serves the Hermes plugin wheel from R2, wakes a sleeping agent through its webhook, serves the operator backoffice on its own host, where WhatsApp numbers are registered and their credentials are kept sealed, and, in development, stands in for the owner's phone with a fake WhatsApp channel. It adapts the ports of [the core](../../libs/core) to the platform.
