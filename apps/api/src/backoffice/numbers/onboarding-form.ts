import { ONBOARDING_PIN_PATTERN } from '@zapbip/types';
import { LABEL_MAX_LENGTH } from '../backoffice-constants';
import { BackofficeCopyKey } from '../backoffice-copy';
import { type FormBody, textFieldOf } from '../form-fields';
import type { FieldErrors } from './field-errors';
import { NumberFormField } from './number-form-fields';

export type OnboardingRequest = {
  signupCode: string;
  phoneNumberId: string;
  wabaId: string;
  label: string;
  pin: string | null;
};

export type OnboardingParse = { isValid: true; request: OnboardingRequest } | { isValid: false; errors: FieldErrors };

const DIGITS_PATTERN = /^\d+$/;

function valueOf(input: { form: FormBody; field: NumberFormField }): string {
  const value = textFieldOf({ form: input.form, name: input.field });
  return value === null ? '' : value.trim();
}

function requiredError(input: { value: string }): BackofficeCopyKey | null {
  return input.value.length === 0 ? BackofficeCopyKey.FieldErrorRequired : null;
}

function digitsError(input: { value: string }): BackofficeCopyKey | null {
  if (input.value.length === 0) return BackofficeCopyKey.FieldErrorRequired;
  return DIGITS_PATTERN.test(input.value) ? null : BackofficeCopyKey.FieldErrorDigits;
}

function labelError(input: { value: string }): BackofficeCopyKey | null {
  return input.value.length >= 1 && input.value.length <= LABEL_MAX_LENGTH ? null : BackofficeCopyKey.FieldErrorLabelLength;
}

function pinError(input: { value: string }): BackofficeCopyKey | null {
  if (input.value.length === 0) return null;
  return ONBOARDING_PIN_PATTERN.test(input.value) ? null : BackofficeCopyKey.FieldErrorPin;
}

function pinOf(input: { form: FormBody }): string | null {
  const value = valueOf({ form: input.form, field: NumberFormField.Pin });
  return value.length === 0 ? null : value;
}

export function parseOnboarding(input: { form: FormBody }): OnboardingParse {
  const { form } = input;
  const request: OnboardingRequest = {
    signupCode: valueOf({ form, field: NumberFormField.SignupCode }),
    phoneNumberId: valueOf({ form, field: NumberFormField.PhoneNumberId }),
    wabaId: valueOf({ form, field: NumberFormField.WabaId }),
    label: valueOf({ form, field: NumberFormField.Label }),
    pin: pinOf({ form }),
  };
  const entries: [NumberFormField, BackofficeCopyKey | null][] = [
    [NumberFormField.SignupCode, requiredError({ value: request.signupCode })],
    [NumberFormField.PhoneNumberId, digitsError({ value: request.phoneNumberId })],
    [NumberFormField.WabaId, digitsError({ value: request.wabaId })],
    [NumberFormField.Label, labelError({ value: request.label })],
    [NumberFormField.Pin, pinError({ value: valueOf({ form, field: NumberFormField.Pin }) })],
  ];
  const errors: FieldErrors = Object.fromEntries(entries.filter(([, error]) => error !== null));
  if (Object.keys(errors).length > 0) return { isValid: false, errors };
  return { isValid: true, request };
}
