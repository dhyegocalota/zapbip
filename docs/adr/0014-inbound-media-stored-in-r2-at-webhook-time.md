# 0014. Inbound media is stored in R2 when the webhook arrives

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [Media reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media) ("Media URLs expire after 5 minutes"; webhook media IDs expire after 7 days); [ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md) (R2 for media, uploads need `Content-Length`)

## Context

An owner's photo, voice note or document reaches the webhook with a media id. The download URL that Meta returns expires after 5 minutes, and the id itself expires after 7 days for webhook ids. The agent that needs the file may call much later, after the owner has gone quiet, and the core's inbox holds the message until then. The core spec already stores inbound bytes in R2 at once, and this ADR records why that is the only option that keeps the content.

## Decision

1. The channel downloads inbound media inside the webhook request: a `GET` on the media id with the bearer token, then a `GET` on the returned URL with the bearer token.
2. The bytes are checked against the webhook's `sha256` before they are stored. A mismatch is a download failure.
3. The bytes go to R2 with a known `Content-Length`, under a key derived from the account and the `wamid`. The agent receives a signed link valid for `MEDIA_LINK_TTL_MS`, as the core specifies.
4. A `404` on the download URL triggers one new request for the URL, as Meta's guidance says. A second failure stores the message with its media status set to unavailable, and the owner gets one session text saying the file did not arrive.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Download at webhook time into R2 (chosen) | the bytes exist whenever an agent asks; no dependency on Meta's expiry | the webhook takes longer when a file is large | — |
| Store the media id and download when an agent asks | no bytes stored until needed | the URL expires in 5 minutes and the id in 7 days; the agent may ask after both | the content would be lost |
| Stream from Meta through the Worker to the agent | no storage | the agent's call is held for the download, which the 50 s ceiling cannot bound; a 100 MB document cannot be streamed within it | fails the wait ceiling |

## Consequences

- Large inbound documents hold the webhook for the download. A 100 MB file is the largest case, and Meta retries a webhook it cannot acknowledge, which the receipt makes safe.
- Storage cost follows `MEDIA_RETENTION_MS`, which the core already names.

## Evidence

- Meta's media reference: "Media URLs expire after 5 minutes. If a download returns `404 Not Found`, request a new URL and try again."
- The same page: "Media IDs returned by the API expire after 30 days, while IDs from webhooks expire after 7 days."
- The inbound document limit is 100 MB, and a larger file returns error 131052.

## Revisit when

- Meta lengthens the URL expiry or drops the webhook id expiry.
- Inbound volume makes the webhook download a measured latency problem.
