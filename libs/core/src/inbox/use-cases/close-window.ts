import type { CloseWindowInput } from './types';

export function closeWindow(input: CloseWindowInput): Promise<void> {
  void input;
  throw new Error('closeWindow is not implemented');
}
