import type { DeployEnvironment } from '../src/operations/deploy-environment';
import type { DeployBlock, DeployShell, EnvironmentVariables, WorkerFacts } from '../src/operations/deploy-preflight';

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
  log: (line: string) => void;
};

export function readDeployBlock(input: { environment: DeployEnvironment }): DeployBlock {
  void input;
  throw new Error('readDeployBlock is not implemented');
}

export function runDeploy(input: DeployRun): Promise<number> {
  void input;
  throw new Error('runDeploy is not implemented');
}
