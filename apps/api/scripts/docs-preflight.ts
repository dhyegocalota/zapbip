import type { CompanyFacts } from '@zapbip/types';
import type { DeployShell, EnvironmentVariables } from '../src/operations/deploy-preflight';

export type DocsPreflightEntry = {
  shell: DeployShell;
  environmentVariables: EnvironmentVariables;
  officialWhatsAppNumber: string;
  company: CompanyFacts;
  npmVersion: string;
  openclawPluginVersion: string;
  log: (line: string) => void;
};

export function runDocsPreflightEntry(input: DocsPreflightEntry): Promise<number> {
  void input;
  throw new Error('runDocsPreflightEntry is not implemented');
}
