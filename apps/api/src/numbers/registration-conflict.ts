export enum RegistrationConflictField {
  MetaAppId = 'meta_app_id',
  PhoneNumberId = 'phone_number_id',
  DisplayNumber = 'display_number',
}

const CONFLICT_FIELDS: string[] = Object.values(RegistrationConflictField);
const UNIQUE_FAILURE_PATTERN = /UNIQUE constraint failed: \w+\.(\w+)/;

export class RegistrationConflictError extends Error {
  readonly field: RegistrationConflictField;

  constructor(input: { field: RegistrationConflictField }) {
    super(`the ${input.field} is already registered`);
    this.field = input.field;
  }
}

export function conflictOf(input: { error: unknown }): RegistrationConflictError | null {
  if (!(input.error instanceof Error)) return null;
  const column = UNIQUE_FAILURE_PATTERN.exec(input.error.message);
  if (column === null || column[1] === undefined || !CONFLICT_FIELDS.includes(column[1])) return null;
  return new RegistrationConflictError({ field: column[1] as RegistrationConflictField });
}
