import { createExecutionContext, env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { HEALTH_PATH } from '../../src/contract/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import production from '../../src/index';
import { ORIGIN } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_SERVER_ERROR = 500;
const UNKNOWN_ENVIRONMENT = 'preview';

async function healthOf(input: { environment: string }): Promise<Response> {
  return production.fetch(
    new Request(`${ORIGIN}${HEALTH_PATH}`),
    { ...env, ENVIRONMENT: input.environment as DeployEnvironment },
    createExecutionContext(),
  );
}

describe('health', () => {
  test('names the configured environment', async () => {
    const response = await healthOf({ environment: DeployEnvironment.Staging });
    expect(response.status).toBe(STATUS_OK);
    expect(await response.json()).toEqual({ ok: true, environment: DeployEnvironment.Staging });
  });

  test('names the development environment the pool binds', async () => {
    const response = await production.fetch(new Request(`${ORIGIN}${HEALTH_PATH}`), env, createExecutionContext());
    expect(await response.json()).toEqual({ ok: true, environment: DeployEnvironment.Development });
  });

  test('an unknown environment is a Worker error that names no secret', async () => {
    const response = await healthOf({ environment: UNKNOWN_ENVIRONMENT });
    expect(response.status).toBe(STATUS_SERVER_ERROR);
    expect(await response.text()).not.toContain(UNKNOWN_ENVIRONMENT);
  });
});
