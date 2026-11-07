import { describe, expect, it } from 'vitest';
import { runSmoke } from '../../scripts/smoke';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { APP_SECRET, CONNECTION_SECRET, fakeStack, INPUTS, type Behavior, VERIFY_TOKEN } from './fake-smoke-stack';

const PUBLIC_ORIGIN = 'https://mcp-staging.zapbip.com';
const ENVIRONMENT_VARIABLES = Object.fromEntries(Object.entries(INPUTS));

async function smoke(input: {
  environment?: DeployEnvironment;
  firstDeploy?: boolean;
  behavior?: Behavior;
  environmentVariables?: Record<string, string | undefined>;
  publicOrigin?: string;
  promptedSecret?: string;
}) {
  const {
    environment = DeployEnvironment.Staging,
    firstDeploy = false,
    behavior = {},
    environmentVariables = ENVIRONMENT_VARIABLES,
    publicOrigin = PUBLIC_ORIGIN,
    promptedSecret = CONNECTION_SECRET,
  } = input;
  const stack = fakeStack(behavior);
  const lines: string[] = [];
  const questions: string[] = [];
  const exitCode = await runSmoke({
    environment,
    firstDeploy,
    environmentVariables,
    publicOrigin,
    smokeFetch: stack.smokeFetch,
    wait: async () => undefined,
    log: (line) => lines.push(line),
    promptHidden: async ({ question }) => {
      questions.push(question);
      return promptedSecret;
    },
  });
  return { exitCode, lines, questions, requests: stack.requests };
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
      publicOrigin: 'https://mcp.zapbip.com',
      behavior: { healthEnvironment: DeployEnvironment.Production },
    });
    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(4);
  });

  it('asks for the smoke connection secret on production and ignores the one in the environment', async () => {
    const environmentVariables = {
      ...ENVIRONMENT_VARIABLES,
      [SmokeInput.BaseUrl]: 'https://mcp.zapbip.com',
      [SmokeInput.ConnectionSecret]: 'zb_conn_left_in_dotenv',
    };
    const { exitCode, questions, requests } = await smoke({
      environment: DeployEnvironment.Production,
      environmentVariables,
      publicOrigin: 'https://mcp.zapbip.com',
      behavior: { healthEnvironment: DeployEnvironment.Production },
    });
    expect(exitCode).toBe(0);
    expect(questions).toHaveLength(1);
    expect(requests.some((request) => request.pathname.includes('zb_conn_left_in_dotenv'))).toBe(false);
  });

  it('refuses an empty answer to the production prompt before any request', async () => {
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.BaseUrl]: 'https://mcp.zapbip.com' };
    const failure = smoke({
      environment: DeployEnvironment.Production,
      environmentVariables,
      publicOrigin: 'https://mcp.zapbip.com',
      promptedSecret: '',
    });
    await expect(failure).rejects.toThrow(SmokeInput.ConnectionSecret);
  });

  it('never asks on staging, nor on a production first deploy', async () => {
    const staging = await smoke({});
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.BaseUrl]: 'https://mcp.zapbip.com' };
    const firstDeploy = await smoke({
      environment: DeployEnvironment.Production,
      firstDeploy: true,
      environmentVariables,
      publicOrigin: 'https://mcp.zapbip.com',
      behavior: { healthEnvironment: DeployEnvironment.Production },
    });
    expect(staging.questions).toEqual([]);
    expect(firstDeploy.questions).toEqual([]);
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
        publicOrigin: PUBLIC_ORIGIN,
        smokeFetch: stack.smokeFetch,
        wait: async () => undefined,
        log: () => undefined,
        promptHidden: async () => CONNECTION_SECRET,
      }),
    ).rejects.toThrow(SmokeInput.BaseUrl);
    expect(stack.requests).toEqual([]);
  });

  it.each([
    ['plain http', { [SmokeInput.BaseUrl]: 'http://mcp-staging.zapbip.com' }, 'https'],
    ['another host', { [SmokeInput.BaseUrl]: 'https://evil.example.com' }, 'mcp-staging.zapbip.com'],
    ['a look-alike host', { [SmokeInput.BaseUrl]: 'https://mcp-staging.zapbip.com.evil.example' }, 'mcp-staging.zapbip.com'],
    ['a url that is not a url', { [SmokeInput.BaseUrl]: 'mcp-staging.zapbip.com' }, SmokeInput.BaseUrl],
  ])('refuses %s before any request, so the connection secret is never sent', async (_name, override, expectedWord) => {
    const stack = fakeStack({});
    const failure = runSmoke({
      environment: DeployEnvironment.Staging,
      firstDeploy: false,
      environmentVariables: { ...ENVIRONMENT_VARIABLES, ...override },
      publicOrigin: PUBLIC_ORIGIN,
      smokeFetch: stack.smokeFetch,
      wait: async () => undefined,
      log: () => undefined,
      promptHidden: async () => CONNECTION_SECRET,
    });
    await expect(failure).rejects.toThrow(expectedWord);
    await expect(failure).rejects.not.toThrow(CONNECTION_SECRET);
    expect(stack.requests).toEqual([]);
  });

  it('accepts the base url with a trailing slash when the host matches', async () => {
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.BaseUrl]: `${PUBLIC_ORIGIN}/` };
    const { exitCode } = await smoke({ environmentVariables });
    expect(exitCode).toBe(0);
  });

  it('lets development use plain http on a local address', async () => {
    const environmentVariables = { ...ENVIRONMENT_VARIABLES, [SmokeInput.BaseUrl]: 'http://127.0.0.1:41234' };
    const { exitCode } = await smoke({
      environment: DeployEnvironment.Development,
      environmentVariables,
      publicOrigin: 'http://localhost:8787',
      behavior: { healthEnvironment: DeployEnvironment.Development },
    });
    expect(exitCode).toBe(0);
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
