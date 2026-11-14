import { OwnerLocale } from '@zapbip/types';
import type { ReactElement } from 'react';
import { welcomePreviewOf } from '../preview-of';

export default function WelcomePreview(): ReactElement {
  return welcomePreviewOf({ locale: OwnerLocale.Spanish });
}
