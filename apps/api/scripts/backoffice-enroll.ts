import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { SECOND_MS } from '@zapbip/types';
import { renderUnicodeCompact } from 'uqr';
import { encodeBase64Url } from '../src/adapters/platform/encoding';
import { sha256Hex } from '../src/adapters/platform/hash';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../src/backoffice/audit/backoffice-audit-action';
import { encodeBase32 } from '../src/backoffice/auth/base32';
import { matchTotpStep } from '../src/backoffice/auth/totp';
import { TOTP_DIGITS, TOTP_PERIOD_MS } from '../src/contract/constants';
import { DeployEnvironment, parseDeployEnvironment } from '../src/operations/deploy-environment';
import { databaseNameOf, type DeployBlock, type DeployShell, wranglerCommand } from '../src/operations/deploy-preflight';
import { createTerminalShell } from '../src/operations/terminal-shell';
import { WorkerSecret } from '../src/operations/worker-secret';
import { readDeployBlock } from './deploy';

export type EnrollmentPrompt = { ask(input: { question: string }): Promise<string> };

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

const KEY_PREFIX = 'zb_bo_';
const KEY_BYTES = 32;
const TOTP_SECRET_BYTES = 20;
const NO_PREVIOUS_STEP = 0;
const CONFIRMATION_ANSWER = DeployEnvironment.Production;
const CONFIRMATION_QUESTION = `Type ${CONFIRMATION_ANSWER} to enroll the operator in ${DeployEnvironment.Production}: `;
const CODE_QUESTION = 'Authenticator code: ';
const STORE_KEY_QUESTION = 'Store the key in your password manager, then press Enter: ';
const NOT_INTERACTIVE_MESSAGE = 'backoffice:enroll needs an interactive terminal\n';
const CODE_REFUSED_MESSAGE = 'The code was not accepted; nothing was written\n';
const SECRET_PUT_FAILED_MESSAGE = 'A secret could not be written; the operator was not reset\n';
const RESET_FAILED_MESSAGE = 'The operator reset failed\n';
const CLEAR_SCREEN = '\x1b[2J\x1b[3J\x1b[H';
const ISSUER = 'zapbip';
const OPERATOR_ACCOUNT = 'operator';
const TOTP_ALGORITHM = 'SHA1';
const PERIOD_SECONDS = TOTP_PERIOD_MS / SECOND_MS;

function operatorKeyOf(input: { bytes: Uint8Array }): string {
  return `${KEY_PREFIX}${encodeBase64Url({ bytes: input.bytes })}`;
}

function otpauthUriOf(input: { environment: DeployEnvironment; secretBase32: string }): string {
  const label = encodeURIComponent(`zapbip backoffice (${input.environment})`);
  return `otpauth://totp/${label}:${OPERATOR_ACCOUNT}?secret=${input.secretBase32}&issuer=${ISSUER}&algorithm=${TOTP_ALGORITHM}&digits=${TOTP_DIGITS}&period=${PERIOD_SECONDS}`;
}

function resetStatementOf(input: { id: string; at: number }): string {
  return [
    'DELETE FROM backoffice_sessions;',
    'UPDATE backoffice_operator SET last_totp_step = 0, failed_attempts = 0, locked_until = NULL WHERE id = 1;',
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

async function resetOperator(input: { run: EnrollmentRun }): Promise<boolean> {
  const { run } = input;
  const isDevelopment = run.environment === DeployEnvironment.Development;
  const result = await run.shell.run(
    wranglerCommand({
      environment: run.environment,
      args: ['d1', 'execute', databaseNameOf({ block: run.block })],
      flags: [isDevelopment ? '--local' : '--remote', '--command', resetStatementOf({ id: run.newId(), at: run.now() })],
    }),
  );
  return result.exitCode === 0;
}

export async function runEnrollment(run: EnrollmentRun): Promise<number> {
  const { environment, prompt, output } = run;
  if (!run.isInteractive) {
    output(NOT_INTERACTIVE_MESSAGE);
    return 1;
  }
  if (!(await isEnrollmentConfirmed({ environment, prompt }))) return 1;
  const key = operatorKeyOf({ bytes: run.randomBytes({ count: KEY_BYTES }) });
  const keyDigest = await sha256Hex({ value: key });
  const secretBase32 = encodeBase32({ bytes: run.randomBytes({ count: TOTP_SECRET_BYTES }) });
  const uri = otpauthUriOf({ environment, secretBase32 });
  output(`Backoffice key (shown once): ${key}\n${uri}\n${renderTerminalQr({ text: uri })}\nAuthenticator text secret: ${secretBase32}\n`);
  const code = await prompt.ask({ question: CODE_QUESTION });
  const step = await matchTotpStep({ secretBase32, code, now: run.now(), lastStep: NO_PREVIOUS_STEP });
  if (step === null) {
    output(CODE_REFUSED_MESSAGE);
    return 1;
  }
  if (environment === DeployEnvironment.Development) {
    output(`${WorkerSecret.BackofficeKeyDigest}=${keyDigest}\n${WorkerSecret.BackofficeTotpSecret}=${secretBase32}\n`);
  }
  const secrets = [
    { name: WorkerSecret.BackofficeKeyDigest, value: keyDigest },
    { name: WorkerSecret.BackofficeTotpSecret, value: secretBase32 },
  ];
  const isStoredRemotely = environment !== DeployEnvironment.Development;
  if (isStoredRemotely && !(await putSecrets({ run, secrets }))) {
    output(SECRET_PUT_FAILED_MESSAGE);
    return 1;
  }
  if (!(await resetOperator({ run }))) {
    output(RESET_FAILED_MESSAGE);
    return 1;
  }
  await prompt.ask({ question: STORE_KEY_QUESTION });
  output(CLEAR_SCREEN);
  return 0;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { environment: { type: 'string' } } });
  const environment = parseDeployEnvironment({ value: values.environment });
  const lineReader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.exitCode = await runEnrollment({
      environment,
      block: readDeployBlock({ environment }),
      shell: createTerminalShell({}),
      prompt: { ask: ({ question }) => lineReader.question(question) },
      isInteractive: process.stdin.isTTY === true && process.stdout.isTTY === true,
      now: Date.now,
      newId: () => crypto.randomUUID(),
      randomBytes: ({ count }) => crypto.getRandomValues(new Uint8Array(count)),
      output: (text) => process.stdout.write(text),
    });
  } finally {
    lineReader.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
