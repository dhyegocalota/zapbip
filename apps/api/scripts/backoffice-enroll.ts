import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import { SECOND_MS } from '@zapbip/types';
import { renderUnicodeCompact } from 'uqr';
import { encodeBase64Url } from '../src/adapters/platform/encoding';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../src/backoffice/audit/backoffice-audit-action';
import { encodeBase32 } from '../src/backoffice/auth/base32';
import { isOperatorEmailAllowed, normalizeEmail } from '../src/backoffice/auth/operator-email';
import { hashPassword } from '../src/backoffice/auth/password-hash';
import { isPasswordLengthAllowed } from '../src/backoffice/auth/password-policy';
import { matchTotpStep } from '../src/backoffice/auth/totp';
import { TOTP_DIGITS, TOTP_PERIOD_MS } from '../src/contract/constants';
import { DeployEnvironment, parseDeployEnvironment } from '../src/operations/deploy-environment';
import { databaseNameOf, type DeployBlock, type DeployShell, wranglerCommand } from '../src/operations/deploy-preflight';
import { createTerminalShell } from '../src/operations/terminal-shell';
import { WorkerSecret } from '../src/operations/worker-secret';
import { readDeployBlock } from './deploy';

export type EnrollmentPrompt = {
  ask(input: { question: string }): Promise<string>;
  askHidden(input: { question: string }): Promise<string>;
};

export type TerminalPrompt = EnrollmentPrompt & { close(): void };

export function parseEnrollmentArguments(input: { args: string[] }): { environment: DeployEnvironment } {
  const { values } = parseArgs({ args: input.args, options: { environment: { type: 'string' } } });
  return { environment: parseDeployEnvironment({ value: values.environment }) };
}

export function createTerminalPrompt(input: { inputStream: NodeJS.ReadableStream; outputStream: NodeJS.WritableStream }): TerminalPrompt {
  const { inputStream, outputStream } = input;
  let isMuted = false;
  const echo = new Writable({
    write(chunk, _encoding, done) {
      if (!isMuted) outputStream.write(chunk);
      done();
    },
  });
  const lineReader = createInterface({ input: inputStream, output: echo, terminal: true });
  return {
    ask: ({ question }) => lineReader.question(question),
    askHidden: async ({ question }) => {
      outputStream.write(question);
      isMuted = true;
      const answer = await lineReader.question('');
      isMuted = false;
      outputStream.write('\n');
      return answer;
    },
    close: () => lineReader.close(),
  };
}

export type EnrollmentRun = {
  environment: DeployEnvironment;
  block: DeployBlock;
  shell: DeployShell;
  prompt: EnrollmentPrompt;
  isInteractive: boolean;
  now: () => number;
  newId: () => string;
  randomBytes: (input: { count: number }) => Uint8Array;
  output: (text: string) => void;
};

const PEPPER_BYTES = 32;
const TOTP_SECRET_BYTES = 20;
const NO_PREVIOUS_STEP = 0;
const CONFIRMATION_ANSWER = DeployEnvironment.Production;
const CONFIRMATION_QUESTION = `Type ${CONFIRMATION_ANSWER} to enroll the operator in ${DeployEnvironment.Production}: `;
const EMAIL_QUESTION = 'Operator email: ';
const PASSWORD_QUESTION = 'Password: ';
const CONFIRM_PASSWORD_QUESTION = 'Confirm password: ';
const CODE_QUESTION = 'Authenticator code: ';
const NOT_INTERACTIVE_MESSAGE = 'backoffice:enroll needs an interactive terminal\n';
const EMAIL_REFUSED_MESSAGE = 'The email must be plain ASCII with one @ and no quotes; nothing was written\n';
const PASSWORD_MISMATCH_MESSAGE = 'The passwords differ; nothing was written\n';
const PASSWORD_REFUSED_MESSAGE = 'The password must have 12 to 128 characters; nothing was written\n';
const CODE_REFUSED_MESSAGE = 'The code was not accepted; nothing was written\n';
const SECRET_PUT_FAILED_MESSAGE = 'A secret could not be written; the operator was not reset\n';
const RESET_FAILED_MESSAGE = 'The operator reset failed\n';
const CLEAR_SCREEN = '\x1b[2J\x1b[3J\x1b[H';
const ISSUER = 'zapbip';
const OPERATOR_ACCOUNT = 'operator';
const TOTP_ALGORITHM = 'SHA1';
const PERIOD_SECONDS = TOTP_PERIOD_MS / SECOND_MS;

function otpauthUriOf(input: { environment: DeployEnvironment; secretBase32: string }): string {
  const label = encodeURIComponent(`zapbip backoffice (${input.environment})`);
  return `otpauth://totp/${label}:${OPERATOR_ACCOUNT}?secret=${input.secretBase32}&issuer=${ISSUER}&algorithm=${TOTP_ALGORITHM}&digits=${TOTP_DIGITS}&period=${PERIOD_SECONDS}`;
}

function resetStatementOf(input: { id: string; at: number; email: string; passwordHash: string }): string {
  return [
    'DELETE FROM backoffice_sessions;',
    'DELETE FROM backoffice_pending_sign_ins;',
    `UPDATE backoffice_operator SET email = '${input.email}', password_hash = '${input.passwordHash}', last_totp_step = 0, failed_attempts = 0, locked_until = NULL, password_failed_attempts = 0, password_locked_until = NULL WHERE id = 1;`,
    `INSERT INTO backoffice_audit (id, at, action, target_kind, target_id, outcome, client_address) VALUES ('${input.id}', ${input.at}, '${BackofficeAuditAction.OperatorEnrolled}', NULL, NULL, '${BackofficeAuditOutcome.Succeeded}', NULL);`,
  ].join(' ');
}

export function renderTerminalQr(input: { text: string }): string {
  return renderUnicodeCompact(input.text);
}

async function isEnrollmentConfirmed(input: { environment: DeployEnvironment; prompt: EnrollmentPrompt }): Promise<boolean> {
  if (input.environment !== DeployEnvironment.Production) return true;
  return (await input.prompt.ask({ question: CONFIRMATION_QUESTION })) === CONFIRMATION_ANSWER;
}

function putSecrets(input: { run: EnrollmentRun; secrets: { name: WorkerSecret; value: string }[] }): Promise<boolean> {
  const { run, secrets } = input;
  return secrets.reduce<Promise<boolean>>(async (previous, secret) => {
    if (!(await previous)) return false;
    const result = await run.shell.run({
      ...wranglerCommand({ environment: run.environment, args: ['secret', 'put', secret.name] }),
      stdin: secret.value,
    });
    return result.exitCode === 0;
  }, Promise.resolve(true));
}

async function resetOperator(input: { run: EnrollmentRun; statement: string }): Promise<boolean> {
  const { run, statement } = input;
  const isDevelopment = run.environment === DeployEnvironment.Development;
  const result = await run.shell.run(
    wranglerCommand({
      environment: run.environment,
      args: ['d1', 'execute', databaseNameOf({ block: run.block })],
      flags: [isDevelopment ? '--local' : '--remote', '--command', statement],
    }),
  );
  return result.exitCode === 0;
}

async function askPassword(input: { run: EnrollmentRun }): Promise<string | null> {
  const { prompt, output } = input.run;
  const password = await prompt.askHidden({ question: PASSWORD_QUESTION });
  const confirmation = await prompt.askHidden({ question: CONFIRM_PASSWORD_QUESTION });
  if (password !== confirmation) {
    output(PASSWORD_MISMATCH_MESSAGE);
    return null;
  }
  if (!isPasswordLengthAllowed({ password })) {
    output(PASSWORD_REFUSED_MESSAGE);
    return null;
  }
  return password;
}

export async function runEnrollment(run: EnrollmentRun): Promise<number> {
  const { environment, prompt, output } = run;
  if (!run.isInteractive) {
    output(NOT_INTERACTIVE_MESSAGE);
    return 1;
  }
  if (!(await isEnrollmentConfirmed({ environment, prompt }))) return 1;
  const email = normalizeEmail({ value: await prompt.ask({ question: EMAIL_QUESTION }) });
  if (!isOperatorEmailAllowed({ value: email })) {
    output(EMAIL_REFUSED_MESSAGE);
    return 1;
  }
  const password = await askPassword({ run });
  if (password === null) return 1;
  const pepper = encodeBase64Url({ bytes: run.randomBytes({ count: PEPPER_BYTES }) });
  const passwordHash = await hashPassword({ password, pepper });
  const secretBase32 = encodeBase32({ bytes: run.randomBytes({ count: TOTP_SECRET_BYTES }) });
  const uri = otpauthUriOf({ environment, secretBase32 });
  output(`${uri}\n${renderTerminalQr({ text: uri })}\nAuthenticator text secret: ${secretBase32}\n`);
  const code = await prompt.ask({ question: CODE_QUESTION });
  const step = await matchTotpStep({ secretBase32, code, now: run.now(), lastStep: NO_PREVIOUS_STEP });
  if (step === null) {
    output(CODE_REFUSED_MESSAGE);
    return 1;
  }
  if (environment === DeployEnvironment.Development) {
    output(`${WorkerSecret.BackofficeTotpSecret}=${secretBase32}\n${WorkerSecret.BackofficePasswordPepper}=${pepper}\n`);
  }
  const secrets = [
    { name: WorkerSecret.BackofficeTotpSecret, value: secretBase32 },
    { name: WorkerSecret.BackofficePasswordPepper, value: pepper },
  ];
  const isStoredRemotely = environment !== DeployEnvironment.Development;
  if (isStoredRemotely && !(await putSecrets({ run, secrets }))) {
    output(SECRET_PUT_FAILED_MESSAGE);
    return 1;
  }
  const statement = resetStatementOf({ id: run.newId(), at: run.now(), email, passwordHash });
  if (!(await resetOperator({ run, statement }))) {
    output(RESET_FAILED_MESSAGE);
    return 1;
  }
  output(CLEAR_SCREEN);
  return 0;
}

async function main(): Promise<void> {
  const { environment } = parseEnrollmentArguments({ args: process.argv.slice(2) });
  const prompt = createTerminalPrompt({ inputStream: process.stdin, outputStream: process.stdout });
  try {
    process.exitCode = await runEnrollment({
      environment,
      block: readDeployBlock({ environment }),
      shell: createTerminalShell({}),
      prompt,
      isInteractive: process.stdin.isTTY === true && process.stdout.isTTY === true,
      now: Date.now,
      newId: () => crypto.randomUUID(),
      randomBytes: ({ count }) => crypto.getRandomValues(new Uint8Array(count)),
      output: (text) => process.stdout.write(text),
    });
  } finally {
    prompt.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
