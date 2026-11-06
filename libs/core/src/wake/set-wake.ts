import type { SetWakeInput, SetWakeResult } from './wake-ports';

export function setWake(input: SetWakeInput): Promise<SetWakeResult> {
  void input;
  throw new Error('setWake is not implemented');
}
