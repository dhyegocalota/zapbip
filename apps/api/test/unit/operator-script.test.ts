import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const API_ROOT = join(import.meta.dirname, '..', '..');
const SCRIPT_PATH = join(API_ROOT, 'scripts', 'operator-account.sh');
const FAKE_PNPM_PATH = join(API_ROOT, 'test', 'support', 'fake-pnpm.mjs');
const MIGRATION_FILES = ['0001_core.sql', '0002_accounts_and_keys.sql'];
const WA_ID = '5511900000000';
const OTHER_WA_ID = '5511900000001';
const ACCOUNT_ID = 'acc_1';
const OTHER_ACCOUNT_ID = 'acc_2';
const CREATED_AT = 1_700_000_000_000;
const SUCCESS_EXIT_CODE = 0;
const DIRECTORY_SERVICE = 'd1';

type RunResult = { status: number | null; stdout: string; stderr: string };

let workDirectory = '';
let database: DatabaseSync;

function run(input: { args: string[] }): RunResult {
  const result = spawnSync('bash', [SCRIPT_PATH, ...input.args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [join(workDirectory, 'bin'), process.env.PATH].join(delimiter),
      OPERATOR_TEST_DATABASE: join(workDirectory, 'directory.sqlite'),
      OPERATOR_TEST_LOG: join(workDirectory, 'wrangler.log'),
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function wranglerCalls(): string[][] {
  const logPath = join(workDirectory, 'wrangler.log');
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

function firstWranglerCall(): string[] {
  const [call] = wranglerCalls();
  if (call === undefined) throw new Error('wrangler was not called');
  return call;
}

function seedAccount(input: { accountId: string; waId: string; state: string }): void {
  database.prepare('INSERT INTO accounts (id, state, created_at) VALUES (?, ?, ?)').run(input.accountId, input.state, CREATED_AT);
  database
    .prepare('INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, NULL, ?, ?)')
    .run(input.waId, input.accountId, 'pt_BR', CREATED_AT);
}

function stateOf(input: { accountId: string }): string {
  const row = database.prepare('SELECT state FROM accounts WHERE id = ?').get(input.accountId);
  if (row === undefined) throw new Error('account missing');
  return String(row.state);
}

function blockedCount(): number {
  const row = database.prepare('SELECT COUNT(*) AS total FROM blocked_phones').get();
  if (row === undefined) throw new Error('count missing');
  return Number(row.total);
}

beforeEach(() => {
  workDirectory = mkdtempSync(join(tmpdir(), 'zapbip-operator-'));
  mkdirSync(join(workDirectory, 'bin'));
  const shimPath = join(workDirectory, 'bin', 'pnpm');
  writeFileSync(shimPath, `#!/usr/bin/env bash\nexec node ${FAKE_PNPM_PATH} "$@"\n`);
  chmodSync(shimPath, 0o755);
  database = new DatabaseSync(join(workDirectory, 'directory.sqlite'));
  MIGRATION_FILES.forEach((file) => database.exec(readFileSync(join(API_ROOT, 'migrations', file), 'utf8')));
});

afterEach(() => {
  database.close();
  rmSync(workDirectory, { recursive: true, force: true });
});

describe('operator-account.sh commands', () => {
  it('[row 349] suspends an active account with one fixed statement', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'active' });
    const result = run({ args: ['suspend', WA_ID] });
    expect(result.status).toBe(SUCCESS_EXIT_CODE);
    expect(wranglerCalls()).toHaveLength(1);
    expect(firstWranglerCall().join(' ')).toContain("UPDATE accounts SET state = 'suspended'");
    expect(firstWranglerCall().join(' ')).toContain(WA_ID);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('suspended');
  });

  it('enables a waitlisted account and refuses an active one', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'waitlisted' });
    seedAccount({ accountId: OTHER_ACCOUNT_ID, waId: OTHER_WA_ID, state: 'active' });
    expect(run({ args: ['enable', WA_ID] }).status).toBe(SUCCESS_EXIT_CODE);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('active');
    const refused = run({ args: ['enable', OTHER_WA_ID] });
    expect(refused.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(refused.stderr).toContain('not waitlisted');
  });

  it('[row 354] resumes a suspended account', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'suspended' });
    expect(run({ args: ['resume', WA_ID] }).status).toBe(SUCCESS_EXIT_CODE);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('active');
  });

  it.each(['active', 'deleting', 'waitlisted'])('[row 353][row 354] refuses to resume a %s account and changes nothing', (state) => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state });
    const result = run({ args: ['resume', WA_ID] });
    expect(result.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(result.stderr).toContain('not suspended');
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe(state);
  });

  it('[row 355] marks an active account as deleting without touching anything else', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'active' });
    seedAccount({ accountId: OTHER_ACCOUNT_ID, waId: OTHER_WA_ID, state: 'active' });
    expect(run({ args: ['delete', WA_ID] }).status).toBe(SUCCESS_EXIT_CODE);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('deleting');
    expect(stateOf({ accountId: OTHER_ACCOUNT_ID })).toBe('active');
    expect(wranglerCalls().every((call) => call.includes(DIRECTORY_SERVICE))).toBe(true);
  });

  it('blocks and unblocks a phone and reports a repeat', () => {
    expect(run({ args: ['block', WA_ID] }).status).toBe(SUCCESS_EXIT_CODE);
    expect(blockedCount()).toBe(1);
    expect(run({ args: ['block', WA_ID] }).stderr).toContain('already blocked');
    expect(run({ args: ['unblock', WA_ID] }).status).toBe(SUCCESS_EXIT_CODE);
    expect(blockedCount()).toBe(0);
    expect(run({ args: ['unblock', WA_ID] }).stderr).toContain('not blocked');
  });

  it('[row 356] blocks then suspends an abusive phone and reverses both', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'active' });
    run({ args: ['block', WA_ID] });
    expect(blockedCount()).toBe(1);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('active');
    run({ args: ['suspend', WA_ID] });
    expect(blockedCount()).toBe(1);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('suspended');
    run({ args: ['unblock', WA_ID] });
    run({ args: ['resume', WA_ID] });
    expect(blockedCount()).toBe(0);
    expect(stateOf({ accountId: ACCOUNT_ID })).toBe('active');
  });

  it('passes the remaining arguments to wrangler', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'active' });
    run({ args: ['suspend', WA_ID, '--env', 'production', '--remote'] });
    expect(firstWranglerCall().slice(-3)).toEqual(['--env', 'production', '--remote']);
  });
});

describe('operator-account.sh refusals', () => {
  it('[row 350] refuses a suspend with punctuation in the wa_id and never calls wrangler', () => {
    seedAccount({ accountId: ACCOUNT_ID, waId: WA_ID, state: 'active' });
    const result = run({ args: ['suspend', '55-11-9'] });
    expect(result.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(wranglerCalls()).toEqual([]);
  });

  it('[row 351] refuses a block with an injection string and never calls wrangler', () => {
    const result = run({ args: ['block', "1' OR '1'='1"] });
    expect(result.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(wranglerCalls()).toEqual([]);
  });

  it('[row 352] refuses a block with three digits and never calls wrangler', () => {
    const result = run({ args: ['block', '123'] });
    expect(result.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(wranglerCalls()).toEqual([]);
  });

  it.each([
    ['punctuation', '55-11-9'],
    ['an injection string', "1' OR '1'='1"],
    ['three digits', '123'],
    ['sixteen digits', '1234567890123456'],
    ['a plus sign', '+5511900000000'],
    ['an empty value', ''],
  ])('refuses a wa_id with %s and never calls wrangler', (_name, waId) => {
    const result = run({ args: ['block', waId] });
    expect(result.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(wranglerCalls()).toEqual([]);
  });

  it.each([[[]], [['suspend']], [['explode', WA_ID]]])('refuses the arguments %j and never calls wrangler', (args) => {
    const result = run({ args });
    expect(result.status).not.toBe(SUCCESS_EXIT_CODE);
    expect(wranglerCalls()).toEqual([]);
  });
});
