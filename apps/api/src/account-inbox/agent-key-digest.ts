const KEY_DIGEST_KEY_PREFIX = 'connector_key_digest:';

export function keyDigestKeyOf(input: { agent: string }): string {
  return `${KEY_DIGEST_KEY_PREFIX}${input.agent}`;
}

export function recordKeyDigest(input: { storage: DurableObjectStorage; agent: string; secretDigest: string }): void {
  input.storage.kv.put(keyDigestKeyOf({ agent: input.agent }), input.secretDigest);
}

export function isCurrentKeyDigest(input: { storage: DurableObjectStorage; agent: string; secretDigest: string }): boolean {
  return input.storage.kv.get<string>(keyDigestKeyOf({ agent: input.agent })) === input.secretDigest;
}
