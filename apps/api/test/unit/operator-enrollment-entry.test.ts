import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { encodeBase32 } from '../../src/backoffice/auth/base32';
import { isOperatorEmailAllowed } from '../../src/backoffice/auth/operator-email';
import { verifyPassword } from '../../src/backoffice/auth/password-hash';
import { totpCodeAt } from '../../src/backoffice/auth/totp';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, TOTP_PERIOD_MS } from '../../src/contract/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import type { DeployShell, ShellCommand } from '../../src/operations/deploy-preflight';
import { createTerminalPrompt, parseEnrollmentArguments, runEnrollment } from '../../scripts/backoffice-enroll';
import { BACKOFFICE_TEST_PASSWORD } from '../support/backoffice-credentials';
import { blockOf } from './fake-deploy-shell';

const NOW = Date.UTC(2026, 10, 7, 12);
const ENROLLMENT_ID = 'enrollment-1';
const PEPPER_BYTES = 32;
const TOTP_SECRET_BYTES = 20;
const PEPPER_FILL = 7;
const NOT_INTERACTIVE_MESSAGE = 'backoffice:enroll needs an interactive terminal';
const CLEAR_SCREEN = '\x1b[2J\x1b[3J\x1b[H';
const WRONG_CODE = '000000';
const CONFIRMATION = 'production';
const EMAIL = 'Operator@Zapbip.test';
const STORED_EMAIL = 'operator@zapbip.test';
const PASSWORD = BACKOFFICE_TEST_PASSWORD;
const SHORT_PASSWORD = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
const LONG_PASSWORD = 'a'.repeat(PASSWORD_MAX_LENGTH + 1);
const EMAIL_QUESTION = 'Operator email: ';
const PASSWORD_QUESTION = 'Password: ';
const HASH_PATTERN = /password_hash = '(pbkdf2-sha256\$20000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43})'/;

const TOTP_SECRET = encodeBase32({ bytes: Uint8Array.from({ length: TOTP_SECRET_BYTES }, (_, index) => index + 1) });
const PEPPER = Buffer.alloc(PEPPER_BYTES, PEPPER_FILL).toString('base64url');
const OTPAUTH_URI = (environment: DeployEnvironment): string =>
  `otpauth://totp/zapbip%20backoffice%20(${environment}):operator?secret=${TOTP_SECRET}&issuer=zapbip&algorithm=SHA1&digits=6&period=30`;

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

function successfulAnswers(input: { code: string }): { answers: string[]; hiddenAnswers: string[] } {
  return { answers: [EMAIL, input.code], hiddenAnswers: [PASSWORD, PASSWORD] };
}

async function enroll(input: {
  environment: DeployEnvironment;
  answers: string[];
  hiddenAnswers?: string[];
  isInteractive?: boolean;
  shell?: RecordingShell;
}) {
  const { environment, answers, hiddenAnswers = [], isInteractive = true, shell = recordingShell({}) } = input;
  const output: string[] = [];
  const questions: string[] = [];
  const hiddenQuestions: string[] = [];
  const exitCode = await runEnrollment({
    environment,
    block: blockOf({ environment }),
    shell,
    prompt: {
      ask: async ({ question }) => {
        questions.push(question);
        return answers.shift() as string;
      },
      askHidden: async ({ question }) => {
        hiddenQuestions.push(question);
        return hiddenAnswers.shift() as string;
      },
    },
    isInteractive,
    now: () => NOW,
    newId: () => ENROLLMENT_ID,
    randomBytes: ({ count }) =>
      count === TOTP_SECRET_BYTES ? Uint8Array.from({ length: count }, (_, index) => index + 1) : new Uint8Array(count).fill(PEPPER_FILL),
    output: (text) => output.push(text),
  });
  return { exitCode, output: output.join(''), questions, hiddenQuestions, shell };
}

function secretPuts(input: { shell: RecordingShell }): ShellCommand[] {
  return input.shell.calls.filter((call) => call.args.includes('put'));
}

function executions(input: { shell: RecordingShell }): ShellCommand[] {
  return input.shell.calls.filter((call) => call.args.includes('execute'));
}

function everythingHandedToTheShell(input: { shell: RecordingShell }): string {
  return input.shell.calls.flatMap((call) => [...call.args, call.stdin === undefined ? '' : call.stdin]).join('\n');
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

  it.each(['operator@zapbip.testé', "o'brien@zapbip.test", 'a"b@zapbip.test', 'two@@zapbip.test', 'no-at-sign', 'a@b@c.test'])(
    'refuses the email %s before any password prompt and writes nothing',
    async (email) => {
      const { exitCode, hiddenQuestions, shell } = await enroll({ environment: DeployEnvironment.Staging, answers: [email] });
      expect(exitCode).toBe(1);
      expect(hiddenQuestions).toEqual([]);
      expect(shell.calls).toEqual([]);
    },
  );

  it('refuses a password confirmation that differs and writes nothing', async () => {
    const { exitCode, shell } = await enroll({
      environment: DeployEnvironment.Staging,
      answers: [EMAIL],
      hiddenAnswers: [PASSWORD, `${PASSWORD}x`],
    });
    expect(exitCode).toBe(1);
    expect(shell.calls).toEqual([]);
  });

  it.each([SHORT_PASSWORD, LONG_PASSWORD])('refuses a password outside 12 to 128 code points and writes nothing', async (password) => {
    const { exitCode, shell } = await enroll({
      environment: DeployEnvironment.Staging,
      answers: [EMAIL],
      hiddenAnswers: [password, password],
    });
    expect(exitCode).toBe(1);
    expect(shell.calls).toEqual([]);
  });

  it('writes nothing when the typed code is wrong', async () => {
    const { exitCode, shell } = await enroll({ environment: DeployEnvironment.Staging, ...successfulAnswers({ code: WRONG_CODE }) });
    expect(exitCode).toBe(1);
    expect(shell.calls).toEqual([]);
  });

  it('asks for the email, then the password twice with the hidden prompt', async () => {
    const { questions, hiddenQuestions } = await enroll({
      environment: DeployEnvironment.Staging,
      ...successfulAnswers({ code: await validCode() }),
    });
    expect(questions[0]).toBe(EMAIL_QUESTION);
    expect(hiddenQuestions).toHaveLength(2);
    expect(hiddenQuestions[0]).toBe(PASSWORD_QUESTION);
  });

  it('puts only the TOTP secret and the pepper through stdin and resets the operator once', async () => {
    const { exitCode, shell } = await enroll({ environment: DeployEnvironment.Staging, ...successfulAnswers({ code: await validCode() }) });
    expect(exitCode).toBe(0);
    const puts = secretPuts({ shell });
    expect(puts.map((call) => call.args.filter((argument) => argument.startsWith('BACKOFFICE_')))).toEqual([
      ['BACKOFFICE_TOTP_SECRET'],
      ['BACKOFFICE_PASSWORD_PEPPER'],
    ]);
    expect(puts.map((call) => call.stdin)).toEqual([TOTP_SECRET, PEPPER]);
    const argumentLines = shell.calls.map((call) => call.args.join(' ')).filter((line) => !line.includes('--command'));
    [TOTP_SECRET, PEPPER, PASSWORD].forEach((value) => expect(argumentLines.join('\n')).not.toContain(value));
    expect(executions({ shell })).toHaveLength(1);
    expect(executions({ shell })[0]!.args).toEqual(expect.arrayContaining(['--remote', '--env', 'staging', '--command']));
  });

  it('resets the operator with the lowercased email and a hash of the password, never the password', async () => {
    const { shell } = await enroll({ environment: DeployEnvironment.Staging, ...successfulAnswers({ code: await validCode() }) });
    const statement = executions({ shell })[0]!.args[executions({ shell })[0]!.args.indexOf('--command') + 1]!;
    expect(statement).toContain(`email = '${STORED_EMAIL}'`);
    const storedHash = HASH_PATTERN.exec(statement)![1]!;
    expect(await verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash })).toBe(true);
    expect(everythingHandedToTheShell({ shell })).not.toContain(PASSWORD);
    [
      'DELETE FROM backoffice_sessions',
      'DELETE FROM backoffice_pending_sign_ins',
      'last_totp_step = 0',
      'failed_attempts = 0',
      'locked_until = NULL',
      'operator.enrolled',
    ].forEach((fragment) => expect(statement).toContain(fragment));
  });

  it('prints the URI once, never the password, no key, and clears the screen last', async () => {
    const { output } = await enroll({ environment: DeployEnvironment.Staging, ...successfulAnswers({ code: await validCode() }) });
    expect(output.split(OTPAUTH_URI(DeployEnvironment.Staging))).toHaveLength(2);
    expect(output).toContain(TOTP_SECRET);
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('Backoffice key');
    expect(output.endsWith(CLEAR_SCREEN)).toBe(true);
  });

  it('stops without resetting the operator when a secret put fails', async () => {
    const shell = recordingShell({ failingFragment: 'BACKOFFICE_TOTP_SECRET' });
    const { exitCode } = await enroll({ environment: DeployEnvironment.Staging, ...successfulAnswers({ code: await validCode() }), shell });
    expect(exitCode).toBe(1);
    expect(executions({ shell })).toEqual([]);
  });

  it('enrolls production after the confirmation, without an env flag', async () => {
    const { exitCode, shell } = await enroll({
      environment: DeployEnvironment.Production,
      answers: [CONFIRMATION, EMAIL, await validCode()],
      hiddenAnswers: [PASSWORD, PASSWORD],
    });
    expect(exitCode).toBe(0);
    expect(secretPuts({ shell })).toHaveLength(2);
    expect(shell.calls.flatMap((call) => call.args)).not.toContain('--env');
  });

  it('prints the two development lines and resets the local database without secret puts', async () => {
    const { exitCode, output, shell } = await enroll({
      environment: DeployEnvironment.Development,
      ...successfulAnswers({ code: await validCode() }),
    });
    expect(exitCode).toBe(0);
    expect(output).toContain(`BACKOFFICE_TOTP_SECRET=${TOTP_SECRET}`);
    expect(output).toContain(`BACKOFFICE_PASSWORD_PEPPER=${PEPPER}`);
    expect(output).not.toContain('BACKOFFICE_KEY_DIGEST');
    expect(secretPuts({ shell })).toEqual([]);
    expect(executions({ shell })).toHaveLength(1);
    expect(executions({ shell })[0]!.args).toEqual(expect.arrayContaining(['--local', '--command']));
    expect(executions({ shell })[0]!.args).not.toContain('--remote');
  });
});

describe('enrollment arguments', () => {
  it('accepts the environment', () => {
    expect(parseEnrollmentArguments({ args: ['--environment', 'staging'] })).toEqual({ environment: DeployEnvironment.Staging });
  });

  it.each([['--password', 'x'], ['--email', 'x@y.test'], ['--password=x']])('refuses %s', (...args) => {
    expect(() => parseEnrollmentArguments({ args: ['--environment', 'staging', ...args] })).toThrow();
  });
});

describe('operator email rule', () => {
  it('accepts a plain ASCII address', () => {
    expect(isOperatorEmailAllowed({ value: 'operator+tag@zapbip.test' })).toBe(true);
  });

  it.each(['', '@zapbip.test', 'operator@', 'a b@zapbip.test', "a'b@zapbip.test", 'a"b@zapbip.test', 'a@b@zapbip.test', 'aé@zapbip.test'])(
    'refuses %j',
    (value) => {
      expect(isOperatorEmailAllowed({ value })).toBe(false);
    },
  );
});

describe('terminal prompt', () => {
  it('never echoes a hidden answer and still echoes a visible one', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const written: string[] = [];
    output.on('data', (chunk: Buffer) => written.push(chunk.toString()));
    const prompt = createTerminalPrompt({ input, output });
    const hidden = prompt.askHidden({ question: PASSWORD_QUESTION });
    input.write('hidden-secret-value\n');
    expect(await hidden).toBe('hidden-secret-value');
    expect(written.join('')).not.toContain('hidden-secret-value');
    expect(written.join('')).toContain(PASSWORD_QUESTION);
    const visible = prompt.ask({ question: EMAIL_QUESTION });
    input.write('visible-answer\n');
    expect(await visible).toBe('visible-answer');
    expect(written.join('')).toContain('visible-answer');
    prompt.close();
  });
});
