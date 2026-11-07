import { randomUUID } from 'node:crypto';
import { openSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { ReadStream } from 'node:tty';
import { parseArgs } from 'node:util';
import { SECOND_MS } from '@zapbip/types';
import { z } from 'zod';
import { readDeployBlock } from './deploy';
import { parseDeployEnvironment, type DeployEnvironment } from '../src/operations/deploy-environment';
import { formatSmokeResult, runSmokeChecks, type SmokeFetch } from '../src/operations/smoke-checks';
import { isConnectionSecretPrompted, readSmokeInputs, SmokeInput } from '../src/operations/smoke-inputs';
import { readHiddenLine } from '../src/operations/hidden-prompt';
import { assertSmokeTarget } from '../src/operations/smoke-target';

const CONNECTION_SECRET_QUESTION = `${SmokeInput.ConnectionSecret} (typing is hidden): `;
const TERMINAL_DEVICE_PATH = '/dev/tty';

const originBlockSchema = z.object({ vars: z.object({ PUBLIC_ORIGIN: z.string() }) });

export type SmokeEntry = {
  environment: DeployEnvironment;
  firstDeploy: boolean;
  environmentVariables: Record<string, string | undefined>;
  publicOrigin: string;
  smokeFetch: SmokeFetch;
  wait: (input: { ms: number }) => Promise<void>;
  log: (line: string) => void;
  promptHidden: (input: { question: string }) => Promise<string>;
};

function firstDeployInstructions(input: { environment: DeployEnvironment }): string[] {
  return [
    'First deploy: checks 2 (mcp initialize) and 5 (fake inbound) were skipped because they need the smoke connection.',
    `Create it: from the phone you will put in ${SmokeInput.OwnerPhone}, send "novo agente smoke" to the zapbip official number (development: through the owner simulator).`,
    `Put the connection secret of the MCP URL in ${SmokeInput.ConnectionSecret} and that phone in ${SmokeInput.OwnerPhone} in .env.`,
    `Run it again: pnpm smoke:${input.environment}`,
  ];
}

export async function runSmoke(input: SmokeEntry): Promise<number> {
  const { environment, firstDeploy, environmentVariables, publicOrigin, smokeFetch, wait, log } = input;
  const connectionSecret = isConnectionSecretPrompted({ environment, firstDeploy })
    ? await input.promptHidden({ question: CONNECTION_SECRET_QUESTION })
    : environmentVariables[SmokeInput.ConnectionSecret];
  const inputs = readSmokeInputs({
    environment,
    firstDeploy,
    environmentVariables: { ...environmentVariables, [SmokeInput.ConnectionSecret]: connectionSecret },
  });
  assertSmokeTarget({ environment, baseUrl: inputs[SmokeInput.BaseUrl] as string, publicOrigin });
  const results = await runSmokeChecks({
    environment,
    firstDeploy,
    inputs,
    smokeFetch,
    wait,
    randomToken: randomUUID,
    nowSeconds: () => Math.floor(Date.now() / SECOND_MS),
  });
  results.forEach((result) => log(formatSmokeResult({ result })));
  if (firstDeploy) firstDeployInstructions({ environment }).forEach(log);
  return results.every((result) => result.passed) ? 0 : 1;
}

async function promptOnTerminal(input: { question: string }): Promise<string> {
  const terminalInput = new ReadStream(openSync(TERMINAL_DEVICE_PATH, 'r'));
  try {
    return await readHiddenLine({ question: input.question, terminalInput, outputStream: process.stdout });
  } finally {
    terminalInput.destroy();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { environment: { type: 'string' }, 'first-deploy': { type: 'boolean' } } });
  const environment = parseDeployEnvironment({ value: values.environment });
  const exitCode = await runSmoke({
    environment,
    firstDeploy: values['first-deploy'] === true,
    environmentVariables: process.env,
    publicOrigin: originBlockSchema.parse(readDeployBlock({ environment })).vars.PUBLIC_ORIGIN,
    smokeFetch: fetch,
    wait: ({ ms }) => delay(ms),
    log: console.log,
    promptHidden: promptOnTerminal,
  });
  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
