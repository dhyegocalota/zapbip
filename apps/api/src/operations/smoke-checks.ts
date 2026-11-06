import type { SmokeCheck, SmokeInputs, SmokeScope } from './smoke-inputs';

export type SmokeFetch = typeof fetch;

export type SmokeResult = { check: SmokeCheck; passed: boolean; status: number; detail: string | null };

export type SmokeRun = SmokeScope & {
  inputs: SmokeInputs;
  smokeFetch: SmokeFetch;
  wait: (input: { ms: number }) => Promise<void>;
  randomToken: () => string;
  nowSeconds: () => number;
};

export function runSmokeChecks(input: SmokeRun): Promise<SmokeResult[]> {
  void input;
  throw new Error('runSmokeChecks is not implemented');
}

export function formatSmokeResult(input: { result: SmokeResult }): string {
  void input;
  throw new Error('formatSmokeResult is not implemented');
}
