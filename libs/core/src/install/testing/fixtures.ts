import { OwnerLocale } from '@zapbip/types';

export const CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
export const LOCALES: OwnerLocale[] = Object.values(OwnerLocale);

export function lastNonEmptyLine(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .at(-1) as string;
}
