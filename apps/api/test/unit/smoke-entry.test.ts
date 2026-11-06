import { describe, expect, it } from 'vitest';
import { runSmoke } from '../../scripts/smoke';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { APP_SECRET, CONNECTION_SECRET, fakeStack, INPUTS, type Behavior, VERIFY_TOKEN } from './fake-smoke-stack';

const ENVIRONMENT_VARIABLES = Object.fromEntries(Object.entries(INPUTS));

async function smoke(input: {
  environment?: DeployEnvironment;
  firstDeploy?: boolean;
  behavior?: Behavior;
  environmentVariables?: Record<string, string | undefined>;
}) {
  const {
    environment = DeployEnvironment.Staging,
    firstDeploy = false,
    behavior = {},
    environmentVariables = ENVIRONMENT_VARIABLES,
  } = input;
  const stack = fakeStack(behavior);
  const lines: string[] = [];
  const exitCode = await runSmoke({
    environment,
    firstDeploy,
    environmentVariables,
    smokeFetch: stack.smokeFetch,
    wait: async () => undefined,
    log: (line) => lines.push(line),
  });
  return { exitCode, lines, requests: stack.requests };
}

describe('smoke entry', () => {
  it('exits zero and prints one line per check when all pass', async () => {
    const { exitCode, lines } = await smoke({});
    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(5);
  });

  it('exits one when a check fails', async () => {
    const { exitCode, lines } = await smoke({ behavior: { toolNames: [] } });
    expect(exitCode).toBe(1);
    expect(lines.some((line) => line.startsWith('FAIL'))).toBe(true);
  });

  it('runs four checks on production and exits zero', async () => {
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.BaseUrl]: 'https://mcp.zapbip.com' };
    const { exitCode, lines } = await smoke({
      environment: DeployEnvironment.Production,
      environmentVariables,
      behavior: { healthEnvironment: DeployEnvironment.Production },
    });
    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(4);
  });

  it('prints no secret', async () => {
    const { lines } = await smoke({});
    [APP_SECRET, VERIFY_TOKEN, CONNECTION_SECRET].forEach((secret) => expect(lines.join('\n')).not.toContain(secret));
  });

  it('sends no request when an input is missing, and names it', async () => {
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.BaseUrl]: undefined };
    const stack = fakeStack({});
    await expect(
      runSmoke({
        environment: DeployEnvironment.Staging,
        firstDeploy: false,
        environmentVariables,
        smokeFetch: stack.smokeFetch,
        wait: async () => undefined,
        log: () => undefined,
      }),
    ).rejects.toThrow(SmokeInput.BaseUrl);
    expect(stack.requests).toEqual([]);
  });

  it('on a first deploy skips checks 2 and 5, and prints how to create the smoke connection and re-run', async () => {
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.ConnectionSecret]: undefined, [SmokeInput.OwnerPhone]: undefined };
    const { exitCode, lines } = await smoke({ firstDeploy: true, environmentVariables });
    const printed = lines.join('\n');
    expect(exitCode).toBe(0);
    expect(lines.filter((line) => /^(PASS|FAIL) /.test(line))).toHaveLength(3);
    expect(printed).toContain('novo agente smoke');
    expect(printed).toContain(SmokeInput.ConnectionSecret);
    expect(printed).toContain('pnpm smoke:staging');
  });
});
