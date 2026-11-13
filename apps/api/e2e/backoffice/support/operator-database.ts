import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TOTP_PERIOD_MS } from '../../../src/contract/constants';
import { totpCodeAt } from '../../../src/backoffice/auth/totp';
import { BACKOFFICE_TEST_TOTP_SECRET } from '../../../test/support/backoffice-credentials';
import { WalkVariable, walkValue } from './walk-environment';

const DATABASE_FILE_SUFFIX = '.sqlite';
const BUSY_TIMEOUT_MILLISECONDS = 5_000;
const OPERATOR_TABLE_PROBE = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'backoffice_operator'";
const RELEASE_OPERATOR_STATEMENTS = [
  'UPDATE backoffice_operator SET last_totp_step = 0, failed_attempts = 0, locked_until = NULL, password_failed_attempts = 0, password_locked_until = NULL',
];
const CLEAR_REGISTRY_STATEMENTS = [
  'DELETE FROM activity_daily',
  'DELETE FROM usage_daily',
  'DELETE FROM blocked_phones',
  'DELETE FROM channel_restrictions',
  'DELETE FROM connections',
  'DELETE FROM owner_identities',
  'DELETE FROM accounts',
  'DELETE FROM waitlist_invites',
  'DELETE FROM landing_waitlist',
  'DELETE FROM whatsapp_numbers',
  'DELETE FROM backoffice_agent_keys',
  'DELETE FROM backoffice_audit',
  'DELETE FROM backoffice_sessions',
];
const PASSWORD_FAILED_ATTEMPTS_QUERY = 'SELECT password_failed_attempts FROM backoffice_operator WHERE id = 1';
const CLEAR_SESSIONS_STATEMENTS = ['DELETE FROM backoffice_sessions'];
const CODE_WINDOW_STEPS = 1;
const CANDIDATE_WRONG_CODES = ['000000', '111111'];

export function openDatabase(): DatabaseSync {
  const persistDirectory = walkValue({ variable: WalkVariable.PersistDirectory });
  const databaseFiles = readdirSync(persistDirectory, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith(DATABASE_FILE_SUFFIX))
    .map((file) => join(persistDirectory, file));
  const operatorDatabases = databaseFiles
    .map((file) => new DatabaseSync(file))
    .filter((database) => {
      const isOperatorDatabase = database.prepare(OPERATOR_TABLE_PROBE).get() !== undefined;
      if (!isOperatorDatabase) database.close();
      return isOperatorDatabase;
    });
  const [operatorDatabase] = operatorDatabases;
  if (operatorDatabase === undefined) throw new Error('the walk database has no operator table');
  operatorDatabase.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`);
  return operatorDatabase;
}

export function execute(input: { statements: string[] }): void {
  const database = openDatabase();
  input.statements.forEach((statement) => database.exec(statement));
  database.close();
}

export function releaseOperator(): void {
  execute({ statements: RELEASE_OPERATOR_STATEMENTS });
}

export function passwordFailedAttempts(): number {
  const database = openDatabase();
  const row = database.prepare(PASSWORD_FAILED_ATTEMPTS_QUERY).get() as { password_failed_attempts: number } | undefined;
  database.close();
  if (row === undefined) throw new Error('the operator row is missing');
  return row.password_failed_attempts;
}

export function clearSessions(): void {
  execute({ statements: CLEAR_SESSIONS_STATEMENTS });
}

export function clearRegistry(): void {
  execute({ statements: [...CLEAR_REGISTRY_STATEMENTS, ...RELEASE_OPERATOR_STATEMENTS] });
}

function windowCodes(): Promise<string[]> {
  const currentStep = Math.floor(Date.now() / TOTP_PERIOD_MS);
  const steps = Array.from({ length: 2 * CODE_WINDOW_STEPS + 1 }, (_, index) => currentStep - CODE_WINDOW_STEPS + index);
  return Promise.all(steps.map((step) => totpCodeAt({ secretBase32: BACKOFFICE_TEST_TOTP_SECRET, step })));
}

export async function currentCode(): Promise<string> {
  const code = (await windowCodes())[CODE_WINDOW_STEPS];
  if (code === undefined) throw new Error('no current code');
  return code;
}

export async function freshCode(): Promise<string> {
  releaseOperator();
  return currentCode();
}

export async function wrongCode(): Promise<string> {
  const codes = await windowCodes();
  const unusedCode = CANDIDATE_WRONG_CODES.find((candidate) => !codes.includes(candidate));
  if (unusedCode === undefined) throw new Error('no wrong code outside the window');
  return unusedCode;
}
