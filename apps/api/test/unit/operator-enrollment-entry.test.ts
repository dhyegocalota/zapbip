import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encodeBase32 } from '../../src/backoffice/auth/base32';
import { totpCodeAt } from '../../src/backoffice/auth/totp';
import { TOTP_PERIOD_MS } from '../../src/contract/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import type { DeployShell, ShellCommand } from '../../src/operations/deploy-preflight';
import { runEnrollment } from '../../scripts/backoffice-enroll';
import { blockOf } from './fake-deploy-shell';

const NOW = Date.UTC(2026, 10, 7, 12);
const ENROLLMENT_ID = 'enrollment-1';
const KEY_BYTES = 32;
const TOTP_SECRET_BYTES = 20;
const KEY_FILL = 7;
const NOT_INTERACTIVE_MESSAGE = 'backoffice:enroll needs an interactive terminal';
const CLEAR_SCREEN = '\x1b[2J\x1b[3J\x1b[H';
const WRONG_CODE = '000000';
const CONFIRMATION = 'production';

const TOTP_SECRET = encodeBase32({ bytes: Uint8Array.from({ length: TOTP_SECRET_BYTES }, (_, index) => index + 1) });
const KEY = `zb_bo_${Buffer.alloc(KEY_BYTES, KEY_FILL).toString('base64url')}`;
const KEY_DIGEST = createHash('sha256').update(KEY).digest('hex');
const OTPAUTH_URI = (environment: DeployEnvironment): string =>
  `otpauth://totp/zapbip%20backoffice%20(${environment}):operator?secret=${TOTP_SECRET}&issuer=zapbip&algorithm=SHA1&digits=6&period=30`;
const RESET_STATEMENT = `DELETE FROM backoffice_sessions; UPDATE backoffice_operator SET last_totp_step = 0, failed_attempts = 0, locked_until = NULL WHERE id = 1; INSERT INTO backoffice_audit (id, at, action, target_kind, target_id, outcome, client_address) VALUES ('${ENROLLMENT_ID}', ${NOW}, 'operator.enrolled', NULL, NULL, 'succeeded', NULL);`;

type RecordingShell = DeployShell & { calls: ShellCommand[] };

function recordingShell(input: { failingFragment?: string }): RecordingShell {
  const calls: ShellCommand[] = [];
  return {
    calls,
    run: async (command) => {
      calls.push(command);
      const line = [command.file, ...command.args].join(' ');
      const isFailing = input.failingFragment !== undefined && line.includes(input.failingFragment);
      return { exitCode: isFailing ? 1 : 0, stdout: '' };
    },
  };
}

async function validCode(): Promise<string> {
  return totpCodeAt({ secretBase32: TOTP_SECRET, step: Math.floor(NOW / TOTP_PERIOD_MS) });
}

async function enroll(input: { environment: DeployEnvironment; answers: string[]; isInteractive?: boolean; shell?: RecordingShell }) {
  const { environment, answers, isInteractive = true, shell = recordingShell({}) } = input;
  const output: string[] = [];
  const questions: string[] = [];
  const exitCode = await runEnrollment({
    environment,
    block: blockOf({ environment }),
    shell,
    prompt: {
      ask: async ({ question }) => {
        questions.push(question);
        return answers.shift() as string;
      },
    },
    isInteractive,
    now: () => NOW,
    newId: () => ENROLLMENT_ID,
    randomBytes: ({ count }) =>
      count === KEY_BYTES ? new Uint8Array(count).fill(KEY_FILL) : Uint8Array.from({ length: count }, (_, index) => index + 1),
    output: (text) => output.push(text),
  });
  return { exitCode, output: output.join(''), questions, shell };
}

function secretPuts(input: { shell: RecordingShell }): ShellCommand[] {
  return input.shell.calls.filter((call) => call.args.includes('put'));
}

describe('operator enrollment', () => {
  it('refuses without an interactive terminal and runs nothing', async () => {
    const { exitCode, output, shell } = await enroll({ environment: DeployEnvironment.Staging, answers: [], isInteractive: false });
    expect(exitCode).toBe(1);
    expect(output).toContain(NOT_INTERACTIVE_MESSAGE);
    expect(shell.calls).toEqual([]);
  });

  it('runs nothing in production unless the owner types production', async () => {
    const { exitCode, shell } = await enroll({ environment: DeployEnvironment.Production, answers: ['prod'] });
    expect(exitCode).toBe(1);
    expect(shell.calls).toEqual([]);
  });

  it('writes nothing when the typed code is wrong', async () => {
    const { exitCode, shell } = await enroll({ environment: DeployEnvironment.Staging, answers: [WRONG_CODE] });
    expect(exitCode).toBe(1);
    expect(shell.calls).toEqual([]);
  });

  it('puts the two secrets through stdin and resets the operator once', async () => {
    const { exitCode, shell } = await enroll({ environment: DeployEnvironment.Staging, answers: [await validCode(), ''] });
    expect(exitCode).toBe(0);
    const puts = secretPuts({ shell });
    expect(puts.map((call) => call.args.filter((argument) => argument.startsWith('BACKOFFICE_')))).toEqual([
      ['BACKOFFICE_KEY_DIGEST'],
      ['BACKOFFICE_TOTP_SECRET'],
    ]);
    expect(puts.map((call) => call.stdin)).toEqual([KEY_DIGEST, TOTP_SECRET]);
    const argumentLines = shell.calls.map((call) => call.args.join(' '));
    [KEY, KEY_DIGEST, TOTP_SECRET].forEach((value) =>
      expect(argumentLines.filter((line) => !line.includes('--command')).join('\n')).not.toContain(value),
    );
    const executions = shell.calls.filter((call) => call.args.includes('execute'));
    expect(executions).toHaveLength(1);
    expect(executions[0]!.args).toEqual(expect.arrayContaining(['--remote', '--env', 'staging', '--command', RESET_STATEMENT]));
  });

  it('prints the key once and the URI once, never the digest, and clears the screen last', async () => {
    const { output } = await enroll({ environment: DeployEnvironment.Staging, answers: [await validCode(), ''] });
    expect(output.split(KEY)).toHaveLength(2);
    expect(output.split(OTPAUTH_URI(DeployEnvironment.Staging))).toHaveLength(2);
    expect(output).toContain(TOTP_SECRET);
    expect(output).not.toContain(KEY_DIGEST);
    expect(output.endsWith(CLEAR_SCREEN)).toBe(true);
  });

  it('stops without resetting the operator when a secret put fails', async () => {
    const shell = recordingShell({ failingFragment: 'BACKOFFICE_TOTP_SECRET' });
    const { exitCode } = await enroll({ environment: DeployEnvironment.Staging, answers: [await validCode(), ''], shell });
    expect(exitCode).toBe(1);
    expect(shell.calls.filter((call) => call.args.includes('execute'))).toEqual([]);
  });

  it('enrolls production after the confirmation, without an env flag', async () => {
    const { exitCode, shell } = await enroll({ environment: DeployEnvironment.Production, answers: [CONFIRMATION, await validCode(), ''] });
    expect(exitCode).toBe(0);
    expect(secretPuts({ shell })).toHaveLength(2);
    expect(shell.calls.flatMap((call) => call.args)).not.toContain('--env');
  });

  it('prints the two development lines and resets the local database without secret puts', async () => {
    const { exitCode, output, shell } = await enroll({ environment: DeployEnvironment.Development, answers: [await validCode(), ''] });
    expect(exitCode).toBe(0);
    expect(output).toContain(`BACKOFFICE_KEY_DIGEST=${KEY_DIGEST}`);
    expect(output).toContain(`BACKOFFICE_TOTP_SECRET=${TOTP_SECRET}`);
    expect(secretPuts({ shell })).toEqual([]);
    const executions = shell.calls.filter((call) => call.args.includes('execute'));
    expect(executions).toHaveLength(1);
    expect(executions[0]!.args).toEqual(expect.arrayContaining(['--local', '--command', RESET_STATEMENT]));
    expect(executions[0]!.args).not.toContain('--remote');
  });
});
