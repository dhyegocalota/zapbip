import { DeployEnvironment } from './deploy-environment';
import { isPlaceholderValue } from './placeholder';

export enum SmokeInput {
  BaseUrl = 'SMOKE_BASE_URL',
  ConnectionSecret = 'SMOKE_CONNECTION_SECRET',
  OwnerPhone = 'SMOKE_OWNER_PHONE',
  AppSecret = 'META_APP_SECRET',
  VerifyToken = 'WHATSAPP_VERIFY_TOKEN',
  PhoneNumberId = 'WHATSAPP_PHONE_NUMBER_ID',
}

export enum SmokeCheck {
  Health = 'health',
  McpInitialize = 'mcp initialize',
  WebhookVerify = 'webhook verify',
  SignatureRejected = 'signature rejected',
  FakeInbound = 'fake inbound',
}

export type SmokeInputs = Partial<Record<SmokeInput, string>>;
export type SmokeScope = { environment: DeployEnvironment; firstDeploy: boolean };
export type SmokeVariables = SmokeScope & { environmentVariables: Record<string, string | undefined> };

const CONNECTION_CHECKS = [SmokeCheck.McpInitialize, SmokeCheck.FakeInbound];

const CHECK_INPUTS: Record<SmokeCheck, SmokeInput[]> = {
  [SmokeCheck.Health]: [SmokeInput.BaseUrl],
  [SmokeCheck.McpInitialize]: [SmokeInput.BaseUrl, SmokeInput.ConnectionSecret],
  [SmokeCheck.WebhookVerify]: [SmokeInput.BaseUrl, SmokeInput.VerifyToken],
  [SmokeCheck.SignatureRejected]: [SmokeInput.BaseUrl],
  [SmokeCheck.FakeInbound]: [
    SmokeInput.BaseUrl,
    SmokeInput.ConnectionSecret,
    SmokeInput.OwnerPhone,
    SmokeInput.AppSecret,
    SmokeInput.PhoneNumberId,
  ],
};

export function smokeChecksFor(input: SmokeScope): SmokeCheck[] {
  const { environment, firstDeploy } = input;
  const isInboundForbidden = environment === DeployEnvironment.Production;
  return Object.values(SmokeCheck)
    .filter((check) => !(firstDeploy && CONNECTION_CHECKS.includes(check)))
    .filter((check) => !(isInboundForbidden && check === SmokeCheck.FakeInbound));
}

function requiredSmokeInputs(input: SmokeScope): SmokeInput[] {
  const required = smokeChecksFor(input).flatMap((check) => CHECK_INPUTS[check]);
  return Object.values(SmokeInput).filter((name) => required.includes(name));
}

function isUsable(value: string | undefined): value is string {
  return value !== undefined && value !== '' && !isPlaceholderValue({ value });
}

export function missingSmokeInputs(input: SmokeVariables): SmokeInput[] {
  return requiredSmokeInputs(input).filter((name) => !isUsable(input.environmentVariables[name]));
}

export function readSmokeInputs(input: SmokeVariables): SmokeInputs {
  const missing = missingSmokeInputs(input);
  if (missing.length > 0) throw new Error(`missing smoke inputs: ${missing.join(', ')}`);
  return Object.fromEntries(requiredSmokeInputs(input).map((name) => [name, input.environmentVariables[name]]));
}
