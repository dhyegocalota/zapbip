import type { OpenWindowInput } from './types';

export function openWindow(input: OpenWindowInput): Promise<void> {
  void input;
  throw new Error('openWindow is not implemented');
}
