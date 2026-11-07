import { renderUnicodeCompact } from 'uqr';
import type { DeployEnvironment } from '../src/operations/deploy-environment';
import type { DeployBlock, DeployShell } from '../src/operations/deploy-preflight';

export type EnrollmentPrompt = { ask(input: { question: string }): Promise<string> };

export type EnrollmentRun = {
  environment: DeployEnvironment;
  block: DeployBlock;
  shell: DeployShell;
  prompt: EnrollmentPrompt;
  isInteractive: boolean;
  now: () => number;
  newId: () => string;
  randomBytes: (input: { count: number }) => Uint8Array;
  output: (text: string) => void;
};

export function renderTerminalQr(input: { text: string }): string {
  return renderUnicodeCompact(input.text);
}

export async function runEnrollment(_input: EnrollmentRun): Promise<number> {
  throw new Error('runEnrollment is not implemented');
}
