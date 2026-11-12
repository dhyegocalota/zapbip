import type { BackofficeCopyKey } from '../backoffice-copy';
import type { WaitlistFormField } from '../waitlist/waitlist-form-fields';
import type { NumberFormField } from './number-form-fields';

export type FieldErrors = Partial<Record<NumberFormField | WaitlistFormField, BackofficeCopyKey>>;
