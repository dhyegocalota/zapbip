import type { AccountCommand, CommandInput } from './account-types';

export function parseAccountCommand(input: CommandInput): AccountCommand | null {
  void input;
  throw new Error('parseAccountCommand is not implemented');
}
