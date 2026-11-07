import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { postOwnerText, secretOf, stack } from './stack';
import { APP_SECRET, OWNER_PHONE, PHONE_NUMBER_ID, VERIFY_TOKEN } from './whatsapp-support/constants';
import { sentRequests } from './whatsapp-support/webhook';

const runCommand = promisify(execFile);
const SEED_AGENT = 'alpha';
const SMOKE_SCRIPT = 'scripts/smoke.ts';
const SMOKE_TIMEOUT_MS = 120_000;
const POLL_TIMEOUT_MS = 10_000;
const WRONG_SECRET = `zb_conn_${'A'.repeat(43)}`;
const INSTALL_LINK_PATTERN = /\/i\/zb_inst_[A-Za-z0-9_-]{22}/;
const FIRST_DEPLOY_NOTICE = 'First deploy:';

type SmokeRun = { exitCode: number; lines: string[]; errorOutput: string };

async function runSmoke(input: { connectionSecret: string; extraArguments: string[] }): Promise<SmokeRun> {
  const environmentVariables = {
    ...process.env,
    [SmokeInput.BaseUrl]: stack().origin,
    [SmokeInput.ConnectionSecret]: input.connectionSecret,
    [SmokeInput.OwnerPhone]: OWNER_PHONE,
    [SmokeInput.AppSecret]: APP_SECRET,
    [SmokeInput.VerifyToken]: VERIFY_TOKEN,
    [SmokeInput.PhoneNumberId]: PHONE_NUMBER_ID,
  };
  const smokeArguments = ['--import', 'tsx', SMOKE_SCRIPT, '--environment', 'development', ...input.extraArguments];
  const finished = await runCommand('node', smokeArguments, { env: environmentVariables }).then(
    (result) => ({ exitCode: 0, stdout: result.stdout, stderr: result.stderr }),
    (failure: { code: number; stdout: string; stderr: string }) => ({
      exitCode: failure.code,
      stdout: failure.stdout,
      stderr: failure.stderr,
    }),
  );
  return { exitCode: finished.exitCode, lines: finished.stdout.split('\n').filter((line) => line !== ''), errorOutput: finished.stderr };
}

function verdictsOf(input: { run: SmokeRun; verdict: string }): string[] {
  return input.run.lines.filter((line) => line.startsWith(input.verdict));
}

describe('owner flow through the smoke script', () => {
  test(
    'the owner creates an agent over WhatsApp and the smoke passes all five checks against the seeded connection',
    async () => {
      await postOwnerText({ text: 'novo agente smoke', replyTo: null });
      await expect.poll(async () => JSON.stringify(await sentRequests()), { timeout: POLL_TIMEOUT_MS }).toMatch(INSTALL_LINK_PATTERN);
      const run = await runSmoke({ connectionSecret: secretOf({ agent: SEED_AGENT }), extraArguments: [] });
      expect(verdictsOf({ run, verdict: 'PASS' })).toHaveLength(5);
      expect(verdictsOf({ run, verdict: 'FAIL' })).toEqual([]);
      expect(run.exitCode).toBe(0);
    },
    SMOKE_TIMEOUT_MS,
  );

  test(
    '--first-deploy skips the two checks that need the connection and prints how to create it',
    async () => {
      const run = await runSmoke({ connectionSecret: WRONG_SECRET, extraArguments: ['--first-deploy'] });
      expect(verdictsOf({ run, verdict: 'PASS' })).toHaveLength(3);
      expect(verdictsOf({ run, verdict: 'FAIL' })).toEqual([]);
      expect(run.lines.some((line) => line.startsWith(FIRST_DEPLOY_NOTICE))).toBe(true);
      expect(run.exitCode).toBe(0);
    },
    SMOKE_TIMEOUT_MS,
  );

  test(
    'a wrong connection secret fails the two connection checks, exits non-zero and never prints the secret',
    async () => {
      const run = await runSmoke({ connectionSecret: WRONG_SECRET, extraArguments: [] });
      expect(verdictsOf({ run, verdict: 'FAIL' })).toHaveLength(2);
      expect(run.exitCode).toBe(1);
      expect(`${run.lines.join('\n')}${run.errorOutput}`).not.toContain(WRONG_SECRET);
    },
    SMOKE_TIMEOUT_MS,
  );
});
