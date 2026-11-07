import type { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import type { DeployEnvironment } from '../contract/deploy-environment';
import type { BackofficeNotice } from './backoffice-notice';

export type LayoutProps = {
  locale: OwnerLocale;
  environment: DeployEnvironment;
  title: string;
  stylesheetHref: string;
  csrfToken: string | null;
  signedIn: boolean;
  currentPath: string;
  notice: BackofficeNotice | null;
  children?: Child;
};

export function Layout(_props: LayoutProps): Child {
  throw new Error('Layout is not implemented');
}
