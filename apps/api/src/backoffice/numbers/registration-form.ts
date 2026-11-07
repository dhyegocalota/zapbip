import { BackofficeCopyKey } from '../backoffice-copy';
import { type FormBody, textFieldOf } from '../form-fields';
import { NEW_META_APP_VALUE, NumberFormField } from './number-form-fields';

export type FieldErrors = Partial<Record<NumberFormField, BackofficeCopyKey>>;

export type RegistrationValues = {
  metaApp: string;
  metaAppId: string;
  metaAppName: string;
  phoneNumberId: string;
  wabaId: string;
  displayNumber: string;
  label: string;
};

export type RegistrationRequest = {
  metaApp: { metaAppRef: string } | { metaAppId: string; label: string; appSecret: string };
  phoneNumberId: string;
  wabaId: string;
  displayNumber: string;
  label: string;
  accessToken: string;
};

export type RegistrationParse =
  | { isValid: true; request: RegistrationRequest; values: RegistrationValues }
  | { isValid: false; values: RegistrationValues; errors: FieldErrors };

const LABEL_MAX_LENGTH = 60;
const DIGITS_PATTERN = /^\d+$/;
const DISPLAY_NUMBER_PATTERN = /^\+\d{7,15}$/;

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

function displayNumberError(input: { value: string }): BackofficeCopyKey | null {
  if (input.value.length === 0) return BackofficeCopyKey.FieldErrorRequired;
  return DISPLAY_NUMBER_PATTERN.test(input.value) ? null : BackofficeCopyKey.FieldErrorDisplayNumber;
}

function labelError(input: { value: string }): BackofficeCopyKey | null {
  return input.value.length >= 1 && input.value.length <= LABEL_MAX_LENGTH ? null : BackofficeCopyKey.FieldErrorLabelLength;
}

function errorsOf(input: { entries: [NumberFormField, BackofficeCopyKey | null][] }): FieldErrors {
  return Object.fromEntries(input.entries.filter(([, error]) => error !== null));
}

export function parseRegistration(input: { form: FormBody; knownMetaAppRefs: string[] }): RegistrationParse {
  const { form, knownMetaAppRefs } = input;
  const field = (name: NumberFormField): string => valueOf({ form, field: name });
  const values: RegistrationValues = {
    metaApp: field(NumberFormField.MetaApp),
    metaAppId: field(NumberFormField.MetaAppId),
    metaAppName: field(NumberFormField.MetaAppName),
    phoneNumberId: field(NumberFormField.PhoneNumberId),
    wabaId: field(NumberFormField.WabaId),
    displayNumber: field(NumberFormField.DisplayNumber),
    label: field(NumberFormField.Label),
  };
  const appSecret = field(NumberFormField.AppSecret);
  const accessToken = field(NumberFormField.AccessToken);
  const isNewMetaApp = values.metaApp === NEW_META_APP_VALUE;
  const metaAppError = isNewMetaApp || knownMetaAppRefs.includes(values.metaApp) ? null : BackofficeCopyKey.FieldErrorRequired;
  const newAppEntries: [NumberFormField, BackofficeCopyKey | null][] = isNewMetaApp
    ? [
        [NumberFormField.MetaAppId, digitsError({ value: values.metaAppId })],
        [NumberFormField.MetaAppName, labelError({ value: values.metaAppName })],
        [NumberFormField.AppSecret, requiredError({ value: appSecret })],
      ]
    : [];
  const errors = errorsOf({
    entries: [
      [NumberFormField.MetaApp, metaAppError],
      ...newAppEntries,
      [NumberFormField.PhoneNumberId, digitsError({ value: values.phoneNumberId })],
      [NumberFormField.WabaId, digitsError({ value: values.wabaId })],
      [NumberFormField.DisplayNumber, displayNumberError({ value: values.displayNumber })],
      [NumberFormField.Label, labelError({ value: values.label })],
      [NumberFormField.AccessToken, requiredError({ value: accessToken })],
    ],
  });
  if (Object.keys(errors).length > 0) return { isValid: false, values, errors };
  const metaApp = isNewMetaApp ? { metaAppId: values.metaAppId, label: values.metaAppName, appSecret } : { metaAppRef: values.metaApp };
  return {
    isValid: true,
    values,
    request: {
      metaApp,
      phoneNumberId: values.phoneNumberId,
      wabaId: values.wabaId,
      displayNumber: values.displayNumber,
      label: values.label,
      accessToken,
    },
  };
}
