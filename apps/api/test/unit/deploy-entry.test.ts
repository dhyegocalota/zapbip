import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDeployBlock, runDeploy, type DeployPrompt } from '../../scripts/deploy';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import {
  blockOf,
  COMPLETE_COMPANY,
  COMPLETE_VARIABLES,
  type FakeShell,
  fakeNameserverResolver,
  fakePackageFetcher,
  fakeShell,
  HOSTED_PLUGINS,
  NPM_VERSION,
  READY_WORKER_FACTS,
} from './fake-deploy-shell';

const CONFIRMATION = 'production';
const WARNINGS_HEADING = 'warnings to resolve before launch:';
const DEPLOYMENT_STATUS_JSON = readFileSync('test/fixtures/deployments-status.json', 'utf8');
const CURRENT_VERSION_ID = '0c8a4f7e-91d2-4b6a-8e35-2f1d7a6b9c40';
const SPLIT_DEPLOYMENT_JSON = JSON.stringify({
  versions: [
    { version_id: 'candidate', percentage: 10 },
    { version_id: 'stable', percentage: 90 },
  ],
});
const EMPTY_DEPLOYMENT_JSON = JSON.stringify({ versions: [] });
const BOOKMARK_JSON = JSON.stringify({ bookmark: 'bookmark-1' });
const REPLIES = {
  'deployments status': { exitCode: 0, stdout: DEPLOYMENT_STATUS_JSON },
  'time-travel info': { exitCode: 0, stdout: BOOKMARK_JSON },
};
const WRANGLER = 'pnpm --filter @zapbip/api exec wrangler';

function fakePrompt(input: { answers: string[] }): DeployPrompt & { questions: string[] } {
  const questions: string[] = [];
  return {
    questions,
    ask: async ({ question }) => {
      questions.push(question);
      return input.answers.shift() as string;
    },
  };
}

async function deploy(input: {
  environment?: DeployEnvironment;
  shell?: FakeShell;
  answers?: string[];
  isInteractive?: boolean;
  firstDeploy?: boolean;
}) {
  const {
    environment = DeployEnvironment.Staging,
    shell = fakeShell({ replies: REPLIES }),
    answers = [],
    isInteractive = true,
    firstDeploy = false,
  } = input;
  const prompt = fakePrompt({ answers });
  const lines: string[] = [];
  const exitCode = await runDeploy({
    environment,
    firstDeploy,
    block: blockOf({ environment }),
    workerFacts: READY_WORKER_FACTS,
    shell,
    prompt,
    isInteractive,
    environmentVariables: COMPLETE_VARIABLES,
    company: COMPLETE_COMPANY,
    npmVersion: NPM_VERSION,
    plugins: HOSTED_PLUGINS,
    packageFetcher: fakePackageFetcher({}),
    nameserverResolver: fakeNameserverResolver({}),
    log: (line) => lines.push(line),
  });
  return { exitCode, shell, prompt, output: lines.join('\n') };
}

describe('deploy entry', () => {
  it('runs the steps in order and exits zero', async () => {
    const { exitCode, shell } = await deploy({});
    const fragments = [
      'git status',
      'secret list',
      'migrations list',
      'pnpm verify',
      '--dry-run',
      'deployments status',
      'time-travel info',
      'wrangler deploy --env staging',
      'smoke.ts',
    ];
    const positions = fragments.map((fragment) => shell.commands.findLastIndex((command) => command.includes(fragment)));
    expect(exitCode).toBe(0);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  it('deploys staging with the environment flag and production without it', async () => {
    const staging = await deploy({});
    expect(staging.shell.commands).toContain(`${WRANGLER} deploy --env staging`);
    const production = await deploy({ environment: DeployEnvironment.Production, answers: [CONFIRMATION] });
    expect(production.shell.commands).toContain(`${WRANGLER} deploy`);
    expect(production.shell.commands.filter((command) => command.includes('--env '))).toEqual([]);
  });

  it('stops at the first preflight refusal before the dry run', async () => {
    const { exitCode, shell, output } = await deploy({ isInteractive: false });
    expect(exitCode).toBe(1);
    expect(output).toContain('interactive');
    expect(shell.commands).toEqual([]);
  });

  it('refuses development', async () => {
    const { exitCode, shell } = await deploy({ environment: DeployEnvironment.Development });
    expect(exitCode).toBe(1);
    expect(shell.commands).toEqual([]);
  });

  it('pin: a pending D1 migration stops the run before the dry run and any deploy', async () => {
    const shell = fakeShell({ replies: { ...REPLIES, 'migrations list': { exitCode: 0, stdout: '0002_accounts.sql pending' } } });
    const { exitCode, output } = await deploy({ shell });
    expect(exitCode).toBe(1);
    expect(output).toContain('pnpm migrate:staging');
    expect(shell.commands.some((command) => command.includes('--dry-run') || command.includes('wrangler deploy'))).toBe(false);
  });

  it('stops when the dry run fails and never deploys', async () => {
    const shell = fakeShell({ replies: { ...REPLIES, '--dry-run': { exitCode: 1, stdout: '' } } });
    const { exitCode } = await deploy({ shell });
    expect(exitCode).toBe(1);
    expect(shell.commands.some((command) => command.endsWith('wrangler deploy --env staging'))).toBe(false);
  });

  it('prints the current version and the database bookmark before deploying', async () => {
    const { output } = await deploy({});
    expect(output).toContain(CURRENT_VERSION_ID);
    expect(output).toContain('bookmark-1');
  });

  it('asks nothing on staging', async () => {
    const { prompt } = await deploy({});
    expect(prompt.questions).toEqual([]);
  });

  it('deploys production only on the exact answer', async () => {
    const accepted = await deploy({ environment: DeployEnvironment.Production, answers: [CONFIRMATION] });
    expect(accepted.exitCode).toBe(0);
    expect(accepted.prompt.questions).toHaveLength(1);
  });

  it('warns and deploys production when a package is not on npm yet', async () => {
    const notFound = { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) };
    const shell = fakeShell({ replies: { ...REPLIES, 'maintainers --json': notFound } });
    const { exitCode, output } = await deploy({ shell, environment: DeployEnvironment.Production, answers: [CONFIRMATION] });
    expect(exitCode).toBe(0);
    expect(output).toContain(`zapbip@${NPM_VERSION} is not on npm yet; publish it before launch`);
  });

  it('prints the warnings again under a heading after the smoke test', async () => {
    const notFound = { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) };
    const shell = fakeShell({ replies: { ...REPLIES, 'maintainers --json': notFound } });
    const { output } = await deploy({ shell, environment: DeployEnvironment.Production, answers: [CONFIRMATION] });
    const [beforeHeading, afterHeading] = output.split(WARNINGS_HEADING);
    expect(beforeHeading).toContain(`zapbip@${NPM_VERSION} is not on npm yet`);
    expect(afterHeading).toContain(`zapbip@${NPM_VERSION} is not on npm yet; publish it before launch`);
  });

  it('pin: prints the warnings again under the heading when the smoke test fails', async () => {
    const notFound = { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) };
    const smokeFailed = { exitCode: 1, stdout: '' };
    const shell = fakeShell({ replies: { ...REPLIES, 'maintainers --json': notFound, 'smoke.ts': smokeFailed } });
    const { exitCode, output } = await deploy({ shell, environment: DeployEnvironment.Production, answers: [CONFIRMATION] });
    const [, afterHeading] = output.split(WARNINGS_HEADING);
    expect(exitCode).toBe(1);
    expect(afterHeading).toContain(`zapbip@${NPM_VERSION} is not on npm yet; publish it before launch`);
  });

  it.each(['Production', 'production ', 'prod', ''])('does not deploy production on the answer %j', async (answer) => {
    const { exitCode, shell, output } = await deploy({ environment: DeployEnvironment.Production, answers: [answer] });
    expect(exitCode).toBe(1);
    expect(output).toContain('not confirmed');
    expect(shell.commands.some((command) => command.endsWith('wrangler deploy'))).toBe(false);
  });

  it('prints the rollback commands with the rollback points when the smoke test fails, and runs none of them', async () => {
    const shell = fakeShell({ replies: { ...REPLIES, 'smoke.ts': { exitCode: 1, stdout: '' } } });
    const { exitCode, output } = await deploy({ shell });
    expect(exitCode).toBe(1);
    expect(output).toContain(`${WRANGLER} rollback ${CURRENT_VERSION_ID} --env staging`);
    expect(output).toContain(`${WRANGLER} d1 time-travel restore zapbip-staging --env staging --bookmark=bookmark-1`);
    expect(shell.commands.some((command) => command.includes('rollback') || command.includes('restore'))).toBe(false);
  });

  it.each([
    ['a deployment without versions', EMPTY_DEPLOYMENT_JSON],
    ['a deployment answer that is not JSON', 'not json'],
  ])('says there is no previous version for %s, and prints it again when the smoke test fails', async (_name, stdout) => {
    const shell = fakeShell({
      replies: { ...REPLIES, 'deployments status': { exitCode: 0, stdout }, 'smoke.ts': { exitCode: 1, stdout: '' } },
    });
    const { exitCode, output } = await deploy({ shell });
    expect(exitCode).toBe(1);
    expect(output).toContain('no previous Worker version');
    expect(output).toContain('redeploy the prior commit');
    expect(output).not.toContain('null');
  });

  it('survives a time-travel answer that is not JSON', async () => {
    const shell = fakeShell({ replies: { ...REPLIES, 'time-travel info': { exitCode: 0, stdout: 'not json' } } });
    const { exitCode, output } = await deploy({ shell });
    expect(exitCode).toBe(0);
    expect(output).toContain('bookmark unavailable');
  });

  it('takes the version carrying most of the traffic as the rollback point', async () => {
    const shell = fakeShell({ replies: { ...REPLIES, 'deployments status': { exitCode: 0, stdout: SPLIT_DEPLOYMENT_JSON } } });
    const { output } = await deploy({ shell });
    expect(output).toContain('stable');
    expect(output).not.toContain('candidate');
  });

  it('reads the current deployment, not the version list', async () => {
    const { shell } = await deploy({});
    expect(shell.commands).toContain(`${WRANGLER} deployments status --env staging --json`);
    expect(shell.commands.some((command) => command.includes('versions list'))).toBe(false);
  });

  it('passes the first deploy flag to the smoke test', async () => {
    const { shell } = await deploy({ firstDeploy: true });
    expect(shell.commands.at(-1)).toContain('smoke.ts --environment staging --first-deploy');
  });
});

describe('read deploy block', () => {
  it('reads the production block from the top level without the nested environments', () => {
    const block = readDeployBlock({ environment: DeployEnvironment.Production });
    expect(block).toMatchObject({ name: 'zapbip-api' });
    expect(block).not.toHaveProperty('env');
  });

  it('reads the staging block with no placeholder left', () => {
    const block = readDeployBlock({ environment: DeployEnvironment.Staging });
    expect(block).toMatchObject({ name: 'zapbip-api-staging' });
    expect(JSON.stringify(block)).not.toContain(PLACEHOLDER_VALUE_PREFIX);
  });
});
