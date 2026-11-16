import { describe, expect, it } from 'vitest';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { parseOnboarding, parseOwnBusiness } from '../../src/backoffice/numbers/onboarding-form';

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

  it('accepts an empty PIN as no PIN', () => {
    expect(parseOnboarding({ form: { ...VALID_FORM, [NumberFormField.Pin]: '' } })).toMatchObject({
      isValid: true,
      request: { pin: null },
    });
  });

  it('accepts a PIN of six digits', () => {
    expect(parseOnboarding({ form: { ...VALID_FORM, [NumberFormField.Pin]: '000123' } })).toMatchObject({
      isValid: true,
      request: { pin: '000123' },
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

describe('the own business form', () => {
  const OWN_FORM = {
    [NumberFormField.OwnNumber]: ' 1000000000000601 ',
    [NumberFormField.Label]: ' Own line ',
    [NumberFormField.Pin]: '',
  };

  it('parses a chosen number, trims the label and reads an empty PIN as no PIN', () => {
    expect(parseOwnBusiness({ form: OWN_FORM })).toEqual({
      isValid: true,
      request: { phoneNumberId: '1000000000000601', label: 'Own line', pin: null },
    });
  });

  it('asks for a chosen number, a label and a six digit PIN', () => {
    expect(
      parseOwnBusiness({ form: { [NumberFormField.OwnNumber]: '', [NumberFormField.Label]: '', [NumberFormField.Pin]: '12345' } }),
    ).toEqual({
      isValid: false,
      errors: {
        [NumberFormField.OwnNumber]: BackofficeCopyKey.FieldErrorRequired,
        [NumberFormField.Label]: BackofficeCopyKey.FieldErrorLabelLength,
        [NumberFormField.Pin]: BackofficeCopyKey.FieldErrorPin,
      },
    });
  });
});
