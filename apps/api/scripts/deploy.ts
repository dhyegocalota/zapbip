import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { experimental_readRawConfig as readRawWranglerConfig } from 'wrangler';
import {
  COMPANY,
  type CompanyFacts,
  OFFICIAL_WHATSAPP_NUMBER,
  OPENCLAW_PLUGIN_NPM_VERSION,
  ZAPBIP_NPM_VERSION,
  ZAPBIP_PYPI_VERSION,
} from '@zapbip/types';
import { z } from 'zod';
import { DeployEnvironment, parseDeployEnvironment } from '../src/operations/deploy-environment';
import {
  databaseNameOf,
  type DeployBlock,
  type DeployShell,
  type EnvironmentVariables,
  runWorkerPreflight,
  type ShellCommand,
  type WorkerFacts,
  wranglerCommand,
} from '../src/operations/deploy-preflight';
import { createApp } from '../src/app';
import { MAX_FUTURE_SKEW_MS } from '../src/adapters/whatsapp/whatsapp-constants';
import { parseJsonOrNull } from '../src/operations/json-text';
import { createPackageFetcher, type PackageFetcher } from '../src/operations/package-fetcher';
import { createTerminalShell } from '../src/operations/terminal-shell';
import { inspectWorker } from '../src/operations/worker-facts';

const WRANGLER_CONFIG_PATH = join(import.meta.dirname, '../wrangler.jsonc');
const SOURCE_ROOT = join(import.meta.dirname, '../src');
const SMOKE_SCRIPT_PATH = 'apps/api/scripts/smoke.ts';
const NO_PREVIOUS_VERSION = 'no previous Worker version: to roll back, redeploy the prior commit';
const CONFIRMATION_ANSWER = DeployEnvironment.Production;
const CONFIRMATION_QUESTION = `Type ${CONFIRMATION_ANSWER} to deploy to ${DeployEnvironment.Production}: `;

export type DeployPrompt = { ask(input: { question: string }): Promise<string> };

export type DeployRun = {
  environment: DeployEnvironment;
  firstDeploy: boolean;
  block: DeployBlock;
  workerFacts: WorkerFacts;
  shell: DeployShell;
  prompt: DeployPrompt;
  isInteractive: boolean;
  environmentVariables: EnvironmentVariables;
  officialWhatsAppNumber: string;
  company: CompanyFacts;
  npmVersion: string;
  openclawPluginVersion: string;
  pypiVersion: string;
  packageFetcher: PackageFetcher;
  log: (line: string) => void;
};

type RollbackPoints = { versionId: string | null; bookmark: string | null };

const deploymentSchema = z.object({ versions: z.array(z.object({ version_id: z.string(), percentage: z.number() })) });
const bookmarkSchema = z.object({ bookmark: z.string() });

function commandLine(input: { command: ShellCommand }): string {
  return [input.command.file, ...input.command.args].join(' ');
}

export function readDeployBlock(input: { environment: DeployEnvironment }): DeployBlock {
  const { env, ...topLevel } = readRawWranglerConfig({ config: WRANGLER_CONFIG_PATH }).rawConfig;
  if (input.environment === DeployEnvironment.Production) return Object.fromEntries(Object.entries(topLevel));
  const block = env?.[input.environment];
  if (!block) throw new Error(`wrangler.jsonc has no ${input.environment} block`);
  return Object.fromEntries(Object.entries(block));
}

function mostTrafficVersionOf(input: { versions: { version_id: string; percentage: number }[] }) {
  return input.versions.reduce<{ version_id: string; percentage: number } | undefined>(
    (current, candidate) => (current === undefined || candidate.percentage > current.percentage ? candidate : current),
    undefined,
  );
}

async function readRollbackPoints(input: {
  environment: DeployEnvironment;
  shell: DeployShell;
  block: DeployBlock;
}): Promise<RollbackPoints> {
  const { environment, shell, block } = input;
  const versions = await shell.run(wranglerCommand({ environment, args: ['deployments', 'status'], flags: ['--json'] }));
  const history = await shell.run(
    wranglerCommand({ environment, args: ['d1', 'time-travel', 'info', databaseNameOf({ block })], flags: ['--json'] }),
  );
  const deployment = deploymentSchema.safeParse(parseJsonOrNull({ text: versions.stdout }));
  const bookmark = bookmarkSchema.safeParse(parseJsonOrNull({ text: history.stdout }));
  const currentVersion = deployment.success ? mostTrafficVersionOf({ versions: deployment.data.versions }) : undefined;
  return {
    versionId: versions.exitCode === 0 && currentVersion ? currentVersion.version_id : null,
    bookmark: history.exitCode === 0 && bookmark.success ? bookmark.data.bookmark : null,
  };
}

function rollbackPointsLine(input: { points: RollbackPoints }): string {
  const { versionId, bookmark } = input.points;
  const versionText = versionId ? `Worker version ${versionId}` : NO_PREVIOUS_VERSION;
  const bookmarkText = bookmark ? `database bookmark ${bookmark}` : 'database bookmark unavailable';
  return `rollback points: ${versionText}; ${bookmarkText}`;
}

function rollbackCommandLines(input: { environment: DeployEnvironment; block: DeployBlock; points: RollbackPoints }): string[] {
  const { environment, block, points } = input;
  const versionLine = points.versionId
    ? [commandLine({ command: wranglerCommand({ environment, args: ['rollback', points.versionId] }) })]
    : [NO_PREVIOUS_VERSION];
  const bookmarkLine = points.bookmark
    ? [
        commandLine({
          command: wranglerCommand({
            environment,
            args: ['d1', 'time-travel', 'restore', databaseNameOf({ block })],
            flags: [`--bookmark=${points.bookmark}`],
          }),
        }),
      ]
    : [];
  return [...versionLine, ...bookmarkLine];
}

async function isDeployConfirmed(input: { environment: DeployEnvironment; prompt: DeployPrompt }): Promise<boolean> {
  if (input.environment !== DeployEnvironment.Production) return true;
  return (await input.prompt.ask({ question: CONFIRMATION_QUESTION })) === CONFIRMATION_ANSWER;
}

function smokeCommand(input: { environment: DeployEnvironment; firstDeploy: boolean }): ShellCommand {
  const firstDeployFlag = input.firstDeploy ? ['--first-deploy'] : [];
  return {
    file: 'node',
    args: ['--env-file=.env', '--import', 'tsx', SMOKE_SCRIPT_PATH, '--environment', input.environment, ...firstDeployFlag],
  };
}

export async function runDeploy(input: DeployRun): Promise<number> {
  const { environment, firstDeploy, block, shell, prompt, log } = input;
  const refusal = await runWorkerPreflight(input);
  if (refusal) {
    log(`refused at ${refusal.step}: ${refusal.message}`);
    return 1;
  }
  const dryRun = await shell.run(wranglerCommand({ environment, args: ['deploy'], flags: ['--dry-run'] }));
  if (dryRun.exitCode !== 0) {
    log('the dry run failed; nothing was deployed');
    return 1;
  }
  const points = await readRollbackPoints({ environment, shell, block });
  log(rollbackPointsLine({ points }));
  if (!(await isDeployConfirmed({ environment, prompt }))) {
    log('the deploy was not confirmed; nothing was deployed');
    return 1;
  }
  const deployed = await shell.run(wranglerCommand({ environment, args: ['deploy'] }));
  if (deployed.exitCode !== 0) {
    log('the deploy failed');
    return 1;
  }
  const smoke = await shell.run(smokeCommand({ environment, firstDeploy }));
  if (smoke.exitCode === 0) return 0;
  log('the smoke test failed; to roll back, run:');
  rollbackCommandLines({ environment, block, points }).forEach(log);
  return 1;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { environment: { type: 'string' }, 'first-deploy': { type: 'boolean' } } });
  const environment = parseDeployEnvironment({ value: values.environment });
  const lineReader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.exitCode = await runDeploy({
      environment,
      firstDeploy: values['first-deploy'] === true,
      block: readDeployBlock({ environment }),
      workerFacts: await inspectWorker({
        sourceRoot: SOURCE_ROOT,
        app: createApp({ extraRoutes: [], developmentMediaOrigin: null, maxFutureSkewMs: MAX_FUTURE_SKEW_MS }),
      }),
      shell: createTerminalShell({}),
      prompt: { ask: ({ question }) => lineReader.question(question) },
      isInteractive: process.stdin.isTTY === true,
      environmentVariables: process.env,
      officialWhatsAppNumber: OFFICIAL_WHATSAPP_NUMBER,
      company: COMPANY,
      npmVersion: ZAPBIP_NPM_VERSION,
      openclawPluginVersion: OPENCLAW_PLUGIN_NPM_VERSION,
      pypiVersion: ZAPBIP_PYPI_VERSION,
      packageFetcher: createPackageFetcher(),
      log: console.log,
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
