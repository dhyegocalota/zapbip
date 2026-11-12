import type { OwnerLocale } from '@zapbip/types';
import type { QuickStart, QuickStartInput } from './contract';

type LinkText = (connectionLink: string) => string;

export function quickStartOf(input: {
  hint: Record<OwnerLocale, string>;
  code: LinkText;
  proof?: LinkText;
}): (quickStart: QuickStartInput) => QuickStart {
  return ({ locale, connectionLink }) => {
    const code = input.code(connectionLink);
    const proof = input.proof === undefined ? code : input.proof(connectionLink);
    return { hint: input.hint[locale], code, proof };
  };
}

export function addressText(connectionLink: string): string {
  return connectionLink;
}
