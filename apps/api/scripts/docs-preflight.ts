import type { AgentPlugin } from '@zapbip/agents';
import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { COMPANY, type CompanyFacts, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { type DeployShell, type EnvironmentVariables, runDocsPreflight } from '../src/operations/deploy-preflight';
import { createPackageFetcher, type PackageFetcher } from '../src/operations/package-fetcher';
import { createTerminalShell } from '../src/operations/terminal-shell';

export type DocsPreflightEntry = {
  shell: DeployShell;
  environmentVariables: EnvironmentVariables;
  company: CompanyFacts;
  npmVersion: string;
  plugins: AgentPlugin[];
  packageFetcher: PackageFetcher;
  log: (line: string) => void;
};

export async function runDocsPreflightEntry(input: DocsPreflightEntry): Promise<number> {
  const { log, ...preflightInput } = input;
  const refusal = await runDocsPreflight(preflightInput);
  if (refusal) {
    log(`refused at ${refusal.step}: ${refusal.message}`);
    return 1;
  }
  log('the docs are ready to publish');
  return 0;
}

if (import.meta.main) {
  runDocsPreflightEntry({
    shell: createTerminalShell({}),
    environmentVariables: process.env,
    company: COMPANY,
    npmVersion: ZAPBIP_NPM_VERSION,
    plugins: Object.values(AGENT_PLUGINS),
    packageFetcher: createPackageFetcher(),
    log: console.log,
  })
    .then((exitCode) => process.exit(exitCode))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
