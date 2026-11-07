import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { WorkerSecret } from '../../src/operations/worker-secret';

const ENV_EXAMPLE_PATH = '../../.env.example';
const GITIGNORE_PATH = '../../.gitignore';
const EXPECTED_WORKER_SECRETS = [
  'WHATSAPP_VERIFY_TOKEN',
  'MEDIA_LINK_SIGNING_KEY',
  'UPLOAD_LINK_SIGNING_KEY',
  'WAKE_SECRET_KEY',
  'NUMBER_REGISTRY_KEY',
  'BACKOFFICE_KEY_DIGEST',
  'BACKOFFICE_TOTP_SECRET',
];
const PIPED_SECRET_NAMES = Object.values(WorkerSecret).filter((name) => name !== WorkerSecret.WhatsAppVerifyToken);
const PREFLIGHT_NAMES = ['ZAPBIP_NPM_PUBLISHER'];
const IGNORED_ENTRIES = ['.env', '.dev.vars'];

const entries: [string, string][] = readFileSync(ENV_EXAMPLE_PATH, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  });
const gitignoreLines = readFileSync(GITIGNORE_PATH, 'utf8').split('\n');

describe('env example', () => {
  it('lists exactly what the scripts read: the smoke inputs and the preflight inputs', () => {
    expect(entries.map(([name]) => name).sort()).toEqual([...Object.values(SmokeInput), ...PREFLIGHT_NAMES].sort());
  });

  it('names exactly the Worker secrets the registry and the backoffice need, with no number credential', () => {
    expect(Object.values(WorkerSecret)).toEqual(EXPECTED_WORKER_SECRETS);
  });

  it.each(PIPED_SECRET_NAMES)('does not hold %s, which no script reads and the runbook pipes into wrangler', (name) => {
    expect(entries.map(([entryName]) => entryName)).not.toContain(name);
  });

  it('pin: gives every name a non-empty placeholder value', () => {
    expect(entries.every(([, value]) => value.startsWith(PLACEHOLDER_VALUE_PREFIX) && value !== PLACEHOLDER_VALUE_PREFIX)).toBe(true);
  });

  it('pin: git ignores the real env files and not the example', () => {
    IGNORED_ENTRIES.forEach((entry) => expect(gitignoreLines).toContain(entry));
    expect(gitignoreLines).not.toContain('.env.example');
  });
});
