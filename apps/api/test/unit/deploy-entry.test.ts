import { describe, expect, it } from 'vitest';
import { readDeployBlock, runDeploy, type DeployPrompt } from '../../scripts/deploy';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { blockOf, COMPLETE_VARIABLES, type FakeShell, fakeShell, OFFICIAL_NUMBER, READY_WORKER_FACTS } from './fake-deploy-shell';

const CONFIRMATION = 'production';
const VERSIONS_JSON = JSON.stringify([{ id: 'version-old' }, { id: 'version-new' }]);
const BOOKMARK_JSON = JSON.stringify({ bookmark: 'bookmark-1' });
const REPLIES = {
  'versions list': { exitCode: 0, stdout: VERSIONS_JSON },
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
    officialWhatsAppNumber: OFFICIAL_NUMBER,
    log: (line) => lines.push(line),
  });
  return { exitCode, shell, prompt, output: lines.join('\n') };
}

describe('deploy entry', () => {
  it('runs the steps in order and exits zero', async () => {
    const { exitCode, shell } = await deploy({});
    const fragments = [
      'git status',
      'pnpm verify',
      'secret list',
      'migrations list',
      '--dry-run',
      'versions list',
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

  it('stops when the dry run fails and never deploys', async () => {
    const shell = fakeShell({ replies: { ...REPLIES, '--dry-run': { exitCode: 1, stdout: '' } } });
    const { exitCode } = await deploy({ shell });
    expect(exitCode).toBe(1);
    expect(shell.commands.some((command) => command.endsWith('wrangler deploy --env staging'))).toBe(false);
  });

  it('prints the current version and the database bookmark before deploying', async () => {
    const { output } = await deploy({});
    expect(output).toContain('version-new');
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
    expect(output).toContain(`${WRANGLER} rollback version-new --env staging`);
    expect(output).toContain(`${WRANGLER} d1 time-travel restore zapbip-staging --bookmark=bookmark-1 --env staging`);
    expect(shell.commands.some((command) => command.includes('rollback') || command.includes('restore'))).toBe(false);
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

  it('reads the staging block with its placeholder database id', () => {
    const block = readDeployBlock({ environment: DeployEnvironment.Staging });
    expect(block).toMatchObject({ name: 'zapbip-api-staging' });
    expect(JSON.stringify(block)).toContain(PLACEHOLDER_VALUE_PREFIX);
  });
});
