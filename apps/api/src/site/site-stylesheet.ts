import { contentHashOf } from '../backoffice/assets/stylesheet';
import stylesheetText from './assets/site.css';
import { SitePath } from './site-paths';

export const SITE_STYLESHEET: string = stylesheetText;
export const SITE_STYLESHEET_HREF = `${SitePath.Stylesheet}?v=${contentHashOf({ text: SITE_STYLESHEET })}`;
