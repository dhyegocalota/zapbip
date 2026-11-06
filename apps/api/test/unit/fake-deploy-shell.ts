import { DeployEnvironment } from '../../src/operations/deploy-environment';
import type { DeployBlock, WorkerFacts, DeployShell, EnvironmentVariables, ShellResult } from '../../src/operations/deploy-preflight';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { WorkerSecret } from '../../src/operations/worker-secret';

export const OFFICIAL_NUMBER = '5511999990000';
export const NPM_VERSION = '0.1.0';
export const DATABASE_ID = '0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d';
export const ALL_SECRETS_JSON = JSON.stringify(Object.values(WorkerSecret).map((name) => ({ name, type: 'secret_text' })));
export const PASSING: ShellResult = { exitCode: 0, stdout: '' };
export const HAPPY_REPLIES: Record<string, ShellResult> = {
  'git status --porcelain': PASSING,
  'git rev-parse --abbrev-ref HEAD': { exitCode: 0, stdout: 'main\n' },
  'git rev-parse HEAD': { exitCode: 0, stdout: 'abc123\n' },
  'git rev-parse origin/main': { exitCode: 0, stdout: 'abc123\n' },
  'secret list': { exitCode: 0, stdout: ALL_SECRETS_JSON },
  'migrations list': { exitCode: 0, stdout: 'No migrations to apply!' },
  'npm view': { exitCode: 0, stdout: `${NPM_VERSION}\n` },
};
export const COMPLETE_VARIABLES: EnvironmentVariables = {
  [SmokeInput.BaseUrl]: 'https://mcp-staging.zapbip.com',
  [SmokeInput.ConnectionSecret]: 'zb_conn_secret',
  [SmokeInput.OwnerPhone]: OFFICIAL_NUMBER,
  [SmokeInput.AppSecret]: 'app-secret',
  [SmokeInput.VerifyToken]: 'verify-token',
  [SmokeInput.PhoneNumberId]: '123456',
};

export type FakeShell = DeployShell & { commands: string[] };

export function fakeShell({ replies: overrides = {} }: { replies?: Record<string, ShellResult> }): FakeShell {
  const replies = { ...HAPPY_REPLIES, ...overrides };
  const commands: string[] = [];
  return {
    commands,
    run: async (command) => {
      const line = [command.file, ...command.args].join(' ');
      commands.push(line);
      const key = Object.keys(replies)
        .sort((first, second) => second.length - first.length)
        .find((candidate) => line.includes(candidate));
      if (!key) return PASSING;
      return replies[key] as ShellResult;
    },
  };
}

export function blockOf(input: { environment: DeployEnvironment; databaseId?: string; bucketName?: string }): DeployBlock {
  const { environment, databaseId = DATABASE_ID, bucketName = `zapbip-media-${input.environment}` } = input;
  return {
    name: `zapbip-api-${environment}`,
    d1_databases: [{ binding: 'CONNECTIONS', database_name: `zapbip-${environment}`, database_id: databaseId }],
    r2_buckets: [{ binding: 'MEDIA', bucket_name: bucketName }],
    vars: { ENVIRONMENT: environment },
    triggers: { crons: ['0 * * * *'] },
  };
}

export const READY_WORKER_FACTS: WorkerFacts = { exportsScheduled: true, mountsInstallRoute: true };
