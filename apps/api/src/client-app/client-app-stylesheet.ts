import { contentHashOf } from '../backoffice/assets/stylesheet';
import stylesheetText from './assets/client-app.css';
import { ClientAppPath } from './client-app-paths';

export const CLIENT_APP_STYLESHEET: string = stylesheetText;
export const CLIENT_APP_STYLESHEET_HREF = `${ClientAppPath.Stylesheet}?v=${contentHashOf({ text: CLIENT_APP_STYLESHEET })}`;
