import { cellOf } from '../waitlist/waitlist-csv';
import type { IssuedInvite } from './access-invite';

const HEADER = 'email,link';
const CELL_SEPARATOR = ',';
const LINE_BREAK = '\n';

export function toInviteLines(input: { invites: IssuedInvite[] }): string {
  return input.invites.map((invite) => `${invite.email}${CELL_SEPARATOR}${invite.link}`).join(LINE_BREAK);
}

export function parseInviteLines(input: { lines: string }): IssuedInvite[] {
  return input.lines
    .split(LINE_BREAK)
    .filter((line) => line.includes(CELL_SEPARATOR))
    .map((line) => {
      const separatorIndex = line.indexOf(CELL_SEPARATOR);
      return { email: line.slice(0, separatorIndex), link: line.slice(separatorIndex + 1) };
    });
}

export function toInvitesCsv(input: { invites: IssuedInvite[] }): string {
  const rows = input.invites.map(
    (invite) => `${cellOf({ text: invite.email })}${CELL_SEPARATOR}${cellOf({ text: invite.link })}${LINE_BREAK}`,
  );
  return `${HEADER}${LINE_BREAK}${rows.join('')}`;
}
