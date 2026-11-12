import { decodeBase64Url, encodeBase64Url } from '../../adapters/platform/encoding';
import { PASSWORD_HASH_ALGORITHM, PASSWORD_HASH_ITERATIONS, PASSWORD_SALT_BYTES } from '../../contract/constants';
import { constantTimeEqual } from './constant-time';
import { normalizePassword } from './password-policy';

const DIGEST_ALGORITHM = 'SHA-256';
const PEPPER_ALGORITHM = { name: 'HMAC', hash: DIGEST_ALGORITHM };
const DERIVATION_ALGORITHM = 'PBKDF2';
const DERIVED_BITS = 256;
const FIELD_SEPARATOR = '$';
const STORED_FIELD_COUNT = 4;

type StoredHash = { iterations: number; salt: Uint8Array; hash: string };

async function pepperedDigestOf(input: { password: string; pepper: string }): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(input.pepper), PEPPER_ALGORITHM, false, ['sign']);
  const digest = await crypto.subtle.sign(PEPPER_ALGORITHM.name, key, encoder.encode(normalizePassword({ value: input.password })));
  return new Uint8Array(digest);
}

async function derivedHashOf(input: { password: string; pepper: string; salt: Uint8Array; iterations: number }): Promise<string> {
  const digest = await pepperedDigestOf({ password: input.password, pepper: input.pepper });
  const key = await crypto.subtle.importKey('raw', digest, DERIVATION_ALGORITHM, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: DERIVATION_ALGORITHM, hash: DIGEST_ALGORITHM, salt: input.salt, iterations: input.iterations },
    key,
    DERIVED_BITS,
  );
  return encodeBase64Url({ bytes: new Uint8Array(bits) });
}

function parseStoredHash(input: { storedHash: string }): StoredHash {
  const fields = input.storedHash.split(FIELD_SEPARATOR);
  const [algorithm, iterationsText, saltText, hash] = fields;
  const iterations = Number(iterationsText);
  const isWellFormed =
    fields.length === STORED_FIELD_COUNT && algorithm === PASSWORD_HASH_ALGORITHM && Number.isInteger(iterations) && iterations > 0;
  if (!isWellFormed || saltText === undefined || hash === undefined) throw new Error('the stored password hash is malformed');
  return { iterations, salt: decodeBase64Url({ value: saltText }), hash };
}

export async function hashPassword(input: { password: string; pepper: string }): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hash = await derivedHashOf({ password: input.password, pepper: input.pepper, salt, iterations: PASSWORD_HASH_ITERATIONS });
  return [PASSWORD_HASH_ALGORITHM, PASSWORD_HASH_ITERATIONS, encodeBase64Url({ bytes: salt }), hash].join(FIELD_SEPARATOR);
}

export async function verifyPassword(input: { password: string; pepper: string; storedHash: string }): Promise<boolean> {
  const stored = parseStoredHash({ storedHash: input.storedHash });
  const hash = await derivedHashOf({ password: input.password, pepper: input.pepper, salt: stored.salt, iterations: stored.iterations });
  return constantTimeEqual({ left: hash, right: stored.hash });
}
