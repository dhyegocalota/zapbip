import { COMPANY, type CompanyFacts, OFFICIAL_WHATSAPP_NUMBER, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { type DeployShell, type EnvironmentVariables, runDocsPreflight } from '../src/operations/deploy-preflight';
import { createTerminalShell } from '../src/operations/terminal-shell';

export type DocsPreflightEntry = {
  shell: DeployShell;
  environmentVariables: EnvironmentVariables;
  officialWhatsAppNumber: string;
  company: CompanyFacts;
  npmVersion: string;
  openclawPluginVersion: string;
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
    officialWhatsAppNumber: OFFICIAL_WHATSAPP_NUMBER,
    company: COMPANY,
    npmVersion: ZAPBIP_NPM_VERSION,
    openclawPluginVersion: ZAPBIP_NPM_VERSION,
    log: console.log,
  })
    .then((exitCode) => process.exit(exitCode))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
