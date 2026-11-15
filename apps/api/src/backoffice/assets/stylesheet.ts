import { contentHashOf } from '../../web-shell/content-hash';
import { withShellStylesheet } from '../../web-shell/shell-stylesheet';
import { BackofficePath } from '../backoffice-paths';
import stylesheetText from './backoffice.css';

export function stylesheetHrefFor(input: { css: string }): string {
  return `${BackofficePath.Stylesheet}?v=${contentHashOf({ text: input.css })}`;
}

export const BACKOFFICE_STYLESHEET: string = withShellStylesheet({ surfaceStylesheet: stylesheetText });
export const STYLESHEET_HREF: string = stylesheetHrefFor({ css: BACKOFFICE_STYLESHEET });
