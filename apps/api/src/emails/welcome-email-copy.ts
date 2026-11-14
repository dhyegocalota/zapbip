import type { OwnerLocale } from '@zapbip/types';
import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export { WelcomeEmailCopyKey };

export function renderWelcomeEmailCopy(_input: { key: WelcomeEmailCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  throw new Error('renderWelcomeEmailCopy is not implemented');
}
