import type { DeployEnvironment } from './deploy-environment';

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

export function smokeChecksFor(input: SmokeScope): SmokeCheck[] {
  void input;
  throw new Error('smokeChecksFor is not implemented');
}

export function missingSmokeInputs(input: SmokeVariables): SmokeInput[] {
  void input;
  throw new Error('missingSmokeInputs is not implemented');
}

export function readSmokeInputs(input: SmokeVariables): SmokeInputs {
  void input;
  throw new Error('readSmokeInputs is not implemented');
}
