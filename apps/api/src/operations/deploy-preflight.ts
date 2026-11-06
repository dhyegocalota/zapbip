import type { DeployEnvironment } from './deploy-environment';

export type ShellCommand = { file: string; args: string[]; stdin?: string };
export type ShellResult = { exitCode: number; stdout: string };
export type DeployShell = { run(input: ShellCommand): Promise<ShellResult> };
export type DeployBlock = Record<string, unknown>;
export type EnvironmentVariables = Record<string, string | undefined>;

export enum PreflightStep {
  Environment = 'environment',
  OfficialNumber = 'official number',
  NpmVersion = 'npm version',
  Git = 'git',
  Gate = 'gate',
  Config = 'config',
  Readiness = 'readiness',
  Secrets = 'secrets',
  Migrations = 'migrations',
  SmokeInputs = 'smoke inputs',
}

export type WorkerFacts = { exportsScheduled: boolean; mountsInstallRoute: boolean };

export type PreflightRefusal = { step: PreflightStep; message: string };

export type WorkerPreflightInput = {
  environment: DeployEnvironment;
  firstDeploy: boolean;
  block: DeployBlock;
  workerFacts: WorkerFacts;
  shell: DeployShell;
  isInteractive: boolean;
  environmentVariables: EnvironmentVariables;
  officialWhatsAppNumber: string;
};

export type DocsPreflightInput = { shell: DeployShell; officialWhatsAppNumber: string; npmVersion: string };

export function wranglerCommand(input: { environment: DeployEnvironment; args: string[]; flags?: string[] }): ShellCommand {
  void input;
  throw new Error('wranglerCommand is not implemented');
}

export function databaseNameOf(input: { block: DeployBlock }): string {
  void input;
  throw new Error('databaseNameOf is not implemented');
}

export function runWorkerPreflight(input: WorkerPreflightInput): Promise<PreflightRefusal | null> {
  void input;
  throw new Error('runWorkerPreflight is not implemented');
}

export function runDocsPreflight(input: DocsPreflightInput): Promise<PreflightRefusal | null> {
  void input;
  throw new Error('runDocsPreflight is not implemented');
}
