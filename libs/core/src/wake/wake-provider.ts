export type PinnedWakeProviderRule = {
  providerId: string;
  host: string;
  pathPattern: RegExp;
  buildHeaders: (input: { token: string }) => Record<string, string>;
};
