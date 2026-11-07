import { describe, expect, it } from 'vitest';
import { conflictOf, RegistrationConflictField } from '../../src/numbers/registration-conflict';

describe('conflictOf', () => {
  it('names the field of a unique failure', () => {
    const error = new Error('D1_ERROR: UNIQUE constraint failed: whatsapp_numbers.phone_number_id: SQLITE_CONSTRAINT');
    expect(conflictOf({ error })?.field).toBe(RegistrationConflictField.PhoneNumberId);
  });

  it('is null for a failure that is not a registration field', () => {
    expect(conflictOf({ error: new Error('UNIQUE constraint failed: whatsapp_numbers.waba_id') })).toBeNull();
  });

  it('is null for a thrown value that is not an Error', () => {
    expect(conflictOf({ error: 'UNIQUE constraint failed: whatsapp_numbers.phone_number_id' })).toBeNull();
  });
});
