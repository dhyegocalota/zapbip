import type { GraphErrorKind } from './graph-error-kind';

export enum OnboardingStep {
  Exchange = 'exchange',
  Subscribe = 'subscribe',
  Register = 'register',
  Read = 'read',
}

export class OnboardingError extends Error {
  readonly step: OnboardingStep;
  readonly kind: GraphErrorKind;

  constructor(input: { step: OnboardingStep; kind: GraphErrorKind }) {
    super(`onboarding failed at ${input.step}: ${input.kind}`);
    this.step = input.step;
    this.kind = input.kind;
  }
}

export type OnboardedNumber = { accessToken: string; displayNumber: string; verifiedName: string | null };

export type OnboardNumberInput = {
  graphBaseUrl: string;
  appSecret: string;
  webhookUrl: string;
  verifyToken: string;
  code: string;
  phoneNumberId: string;
  wabaId: string;
  pin: string;
  fetcher: typeof fetch;
};

export function onboardNumber(input: OnboardNumberInput): Promise<OnboardedNumber> {
  throw new Error(`onboardNumber is not implemented for ${input.phoneNumberId}`);
}
