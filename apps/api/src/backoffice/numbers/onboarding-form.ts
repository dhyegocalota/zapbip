import type { FormBody } from '../form-fields';
import type { FieldErrors } from './field-errors';

export type OnboardingRequest = {
  signupCode: string;
  phoneNumberId: string;
  wabaId: string;
  label: string;
  pin: string;
};

export type OnboardingParse = { isValid: true; request: OnboardingRequest } | { isValid: false; errors: FieldErrors };

export function parseOnboarding(input: { form: FormBody }): OnboardingParse {
  throw new Error(`parseOnboarding is not implemented for ${Object.keys(input.form).length} fields`);
}
