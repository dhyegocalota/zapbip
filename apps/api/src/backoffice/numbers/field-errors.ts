import type { BackofficeCopyKey } from '../backoffice-copy';
import type { NumberFormField } from './number-form-fields';

export type FieldErrors = Partial<Record<NumberFormField, BackofficeCopyKey>>;
