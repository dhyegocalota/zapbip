import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { missingSmokeInputs, readSmokeInputs, SmokeCheck, SmokeInput, smokeChecksFor } from '../../src/operations/smoke-inputs';

const COMPLETE_VARIABLES: Record<string, string> = {
  [SmokeInput.BaseUrl]: 'https://mcp-staging.zapbip.com',
  [SmokeInput.ConnectionSecret]: 'zb_conn_secret',
  [SmokeInput.OwnerPhone]: '5511999990000',
  [SmokeInput.AppSecret]: 'app-secret',
  [SmokeInput.VerifyToken]: 'verify-token',
  [SmokeInput.PhoneNumberId]: '123456',
};
const STAGING_SCOPE = { environment: DeployEnvironment.Staging, firstDeploy: false };
const PRODUCTION_SCOPE = { environment: DeployEnvironment.Production, firstDeploy: false };
const FIRST_DEPLOY_SCOPE = { environment: DeployEnvironment.Staging, firstDeploy: true };
const NAMED_INPUTS = [SmokeInput.BaseUrl, SmokeInput.ConnectionSecret, SmokeInput.OwnerPhone, SmokeInput.AppSecret];

function variablesWith(input: { name: SmokeInput; value: string | undefined }): Record<string, string | undefined> {
  return { ...COMPLETE_VARIABLES, [input.name]: input.value };
}

describe('smoke inputs', () => {
  it('reads the smoke number credentials under names no Worker secret shares', () => {
    expect([SmokeInput.AppSecret, SmokeInput.PhoneNumberId]).toEqual(['SMOKE_META_APP_SECRET', 'SMOKE_PHONE_NUMBER_ID']);
  });

  it.each(NAMED_INPUTS)('names %s when it is missing', (name) => {
    const environmentVariables = variablesWith({ name, value: undefined });
    expect(missingSmokeInputs({ ...STAGING_SCOPE, environmentVariables })).toEqual([name]);
    expect(() => readSmokeInputs({ ...STAGING_SCOPE, environmentVariables })).toThrow(name);
  });

  it.each(NAMED_INPUTS)('names %s when it is empty', (name) => {
    const environmentVariables = variablesWith({ name, value: '' });
    expect(() => readSmokeInputs({ ...STAGING_SCOPE, environmentVariables })).toThrow(name);
  });

  it.each(NAMED_INPUTS)('names %s when it is a placeholder', (name) => {
    const environmentVariables = variablesWith({ name, value: `${PLACEHOLDER_VALUE_PREFIX}x` });
    expect(() => readSmokeInputs({ ...STAGING_SCOPE, environmentVariables })).toThrow(name);
  });

  it('names a lowercase placeholder', () => {
    const environmentVariables = variablesWith({ name: SmokeInput.BaseUrl, value: 'replace-with-url' });
    expect(() => readSmokeInputs({ ...STAGING_SCOPE, environmentVariables })).toThrow(SmokeInput.BaseUrl);
  });

  it('returns every required value when all are set', () => {
    expect(readSmokeInputs({ ...STAGING_SCOPE, environmentVariables: COMPLETE_VARIABLES })).toEqual(COMPLETE_VARIABLES);
  });

  it('lists every missing input at once', () => {
    expect(missingSmokeInputs({ ...STAGING_SCOPE, environmentVariables: {} })).toEqual(Object.values(SmokeInput));
  });

  it('runs all five checks on staging and development', () => {
    expect(smokeChecksFor(STAGING_SCOPE)).toEqual(Object.values(SmokeCheck));
    expect(smokeChecksFor({ environment: DeployEnvironment.Development, firstDeploy: false })).toEqual(Object.values(SmokeCheck));
  });

  it('runs checks 1 to 4 on production and asks for no inbound-only input', () => {
    expect(smokeChecksFor(PRODUCTION_SCOPE)).toEqual([
      SmokeCheck.Health,
      SmokeCheck.McpInitialize,
      SmokeCheck.WebhookVerify,
      SmokeCheck.SignatureRejected,
    ]);
    const environmentVariables = { ...COMPLETE_VARIABLES, [SmokeInput.AppSecret]: undefined, [SmokeInput.OwnerPhone]: undefined };
    expect(missingSmokeInputs({ ...PRODUCTION_SCOPE, environmentVariables })).toEqual([]);
  });

  it('does not ask production for the connection secret in the environment, because it is prompted', () => {
    const environmentVariables = { ...COMPLETE_VARIABLES, [SmokeInput.ConnectionSecret]: undefined };
    expect(missingSmokeInputs({ ...PRODUCTION_SCOPE, environmentVariables })).toEqual([]);
    expect(() => readSmokeInputs({ ...PRODUCTION_SCOPE, environmentVariables })).toThrow(SmokeInput.ConnectionSecret);
    expect(missingSmokeInputs({ ...STAGING_SCOPE, environmentVariables })).toEqual([SmokeInput.ConnectionSecret]);
  });

  it('skips the connection-dependent checks 2 and 5 on a first deploy and asks for no connection input', () => {
    expect(smokeChecksFor(FIRST_DEPLOY_SCOPE)).toEqual([SmokeCheck.Health, SmokeCheck.WebhookVerify, SmokeCheck.SignatureRejected]);
    const environmentVariables = {
      ...COMPLETE_VARIABLES,
      [SmokeInput.ConnectionSecret]: `${PLACEHOLDER_VALUE_PREFIX}x`,
      [SmokeInput.OwnerPhone]: undefined,
      [SmokeInput.AppSecret]: undefined,
    };
    expect(missingSmokeInputs({ ...FIRST_DEPLOY_SCOPE, environmentVariables })).toEqual([]);
  });
});
