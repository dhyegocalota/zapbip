import { describe, expect, it } from 'vitest';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { NEW_META_APP_VALUE, NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { parseRegistration } from '../../src/backoffice/numbers/registration-form';

const KNOWN_META_APP_REF = 'app_known';

function formWith(input: Record<string, string>): Record<string, string> {
  return {
    [NumberFormField.MetaApp]: NEW_META_APP_VALUE,
    [NumberFormField.MetaAppId]: '900000000001',
    [NumberFormField.MetaAppName]: 'Main app',
    [NumberFormField.AppSecret]: 'secret',
    [NumberFormField.PhoneNumberId]: '1000000000001',
    [NumberFormField.WabaId]: '3000000000001',
    [NumberFormField.DisplayNumber]: '+5511900000001',
    [NumberFormField.Label]: 'Brazil',
    [NumberFormField.AccessToken]: 'token',
    ...input,
  };
}

function parse(input: Record<string, string>) {
  return parseRegistration({ form: formWith(input), knownMetaAppRefs: [KNOWN_META_APP_REF] });
}

describe('the registration form', () => {
  it('accepts a new Meta app with a number', () => {
    const parsed = parse({});
    expect(parsed.isValid).toBe(true);
    expect(parsed.isValid && parsed.request.metaApp).toEqual({ metaAppId: '900000000001', label: 'Main app', appSecret: 'secret' });
  });

  it('accepts an existing Meta app and ignores the new app fields', () => {
    const parsed = parse({
      [NumberFormField.MetaApp]: KNOWN_META_APP_REF,
      [NumberFormField.MetaAppId]: '',
      [NumberFormField.AppSecret]: '',
    });
    expect(parsed.isValid && parsed.request.metaApp).toEqual({ metaAppRef: KNOWN_META_APP_REF });
  });

  it('refuses a Meta app the registry does not know', () => {
    const parsed = parse({ [NumberFormField.MetaApp]: 'app_other' });
    expect(!parsed.isValid && parsed.errors[NumberFormField.MetaApp]).toBe(BackofficeCopyKey.FieldErrorRequired);
  });

  it.each([
    { field: NumberFormField.PhoneNumberId, value: '12a', error: BackofficeCopyKey.FieldErrorDigits },
    { field: NumberFormField.WabaId, value: '', error: BackofficeCopyKey.FieldErrorRequired },
    { field: NumberFormField.DisplayNumber, value: '+55', error: BackofficeCopyKey.FieldErrorDisplayNumber },
    { field: NumberFormField.DisplayNumber, value: '5511900000001', error: BackofficeCopyKey.FieldErrorDisplayNumber },
    { field: NumberFormField.Label, value: '   ', error: BackofficeCopyKey.FieldErrorLabelLength },
    { field: NumberFormField.AccessToken, value: '  ', error: BackofficeCopyKey.FieldErrorRequired },
    { field: NumberFormField.AppSecret, value: '', error: BackofficeCopyKey.FieldErrorRequired },
  ])('reports $error for $field = "$value"', ({ field, value, error }) => {
    const parsed = parse({ [field]: value });
    expect(!parsed.isValid && parsed.errors[field]).toBe(error);
  });

  it('keeps the non-secret values and drops the secrets from an invalid parse', () => {
    const parsed = parse({ [NumberFormField.PhoneNumberId]: 'x' });
    expect(parsed.isValid).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('secret');
    expect(JSON.stringify(parsed)).not.toContain('token');
    expect(!parsed.isValid && parsed.values.label).toBe('Brazil');
  });
});
