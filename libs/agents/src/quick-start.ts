import type { OwnerLocale } from '@zapbip/types';
import type { QuickStart, QuickStartInput } from './contract';

type LinkText = (connectionLink: string) => string;

export function quickStartOf(input: {
  hint: Record<OwnerLocale, string>;
  path?: Record<OwnerLocale, string[]>;
  code: LinkText;
}): (quickStart: QuickStartInput) => QuickStart {
  return ({ locale, connectionLink }) => {
    const code = input.code(connectionLink);
    const path = input.path === undefined ? [] : input.path[locale];
    return { hint: input.hint[locale], path, code };
  };
}

export function addressText(connectionLink: string): string {
  return connectionLink;
}
