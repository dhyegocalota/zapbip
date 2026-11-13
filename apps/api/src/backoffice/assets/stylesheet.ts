import { withShellStylesheet } from '../../web-shell/shell-stylesheet';
import { BackofficePath } from '../backoffice-paths';
import stylesheetText from './backoffice.css';

const HASH_MULTIPLIER = 31;
const HASH_MODULUS = 2 ** 32;
const HEXADECIMAL_RADIX = 16;

export function contentHashOf(input: { text: string }): string {
  const hash = Array.from(input.text).reduce(
    (current, character) => (current * HASH_MULTIPLIER + character.charCodeAt(0)) % HASH_MODULUS,
    0,
  );
  return hash.toString(HEXADECIMAL_RADIX);
}

export function stylesheetHrefFor(input: { css: string }): string {
  return `${BackofficePath.Stylesheet}?v=${contentHashOf({ text: input.css })}`;
}

export const BACKOFFICE_STYLESHEET: string = withShellStylesheet({ surfaceStylesheet: stylesheetText });
export const STYLESHEET_HREF: string = stylesheetHrefFor({ css: BACKOFFICE_STYLESHEET });
