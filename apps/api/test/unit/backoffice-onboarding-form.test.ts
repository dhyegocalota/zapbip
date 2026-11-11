import { describe, expect, it } from 'vitest';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { parseOnboarding } from '../../src/backoffice/numbers/onboarding-form';

const VALID_FORM = {
  [NumberFormField.SignupCode]: 'signup-code',
  [NumberFormField.PhoneNumberId]: '1000000000000501',
  [NumberFormField.WabaId]: '3000000000000501',
  [NumberFormField.Label]: ' Main line ',
  [NumberFormField.Pin]: '482915',
};

describe('the onboarding form', () => {
  it('parses a valid form and trims the label', () => {
    expect(parseOnboarding({ form: VALID_FORM })).toEqual({
      isValid: true,
      request: {
        signupCode: 'signup-code',
        phoneNumberId: '1000000000000501',
        wabaId: '3000000000000501',
        label: 'Main line',
        pin: '482915',
      },
    });
  });

  it.each([
    [NumberFormField.SignupCode, '', BackofficeCopyKey.FieldErrorRequired],
    [NumberFormField.PhoneNumberId, '10a', BackofficeCopyKey.FieldErrorDigits],
    [NumberFormField.WabaId, '', BackofficeCopyKey.FieldErrorRequired],
    [NumberFormField.Label, '', BackofficeCopyKey.FieldErrorLabelLength],
    [NumberFormField.Label, 'x'.repeat(61), BackofficeCopyKey.FieldErrorLabelLength],
    [NumberFormField.Pin, '12345', BackofficeCopyKey.FieldErrorPin],
    [NumberFormField.Pin, '1234567', BackofficeCopyKey.FieldErrorPin],
    [NumberFormField.Pin, 'abcdef', BackofficeCopyKey.FieldErrorPin],
  ])('reports only %s when it is %j', (field, value, error) => {
    expect(parseOnboarding({ form: { ...VALID_FORM, [field]: value } })).toEqual({ isValid: false, errors: { [field]: error } });
  });
});
