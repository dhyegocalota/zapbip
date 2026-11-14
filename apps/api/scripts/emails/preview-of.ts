import type { OwnerLocale } from '@zapbip/types';
import { createElement, type ReactElement } from 'react';
import { REFERRAL_SHARING_OPEN } from '../../src/site/site-constants';
import { WelcomeEmailTemplate } from './welcome-email-template';

export function welcomePreviewOf(input: { locale: OwnerLocale }): ReactElement {
  return createElement(WelcomeEmailTemplate, { locale: input.locale, isReferralOpen: REFERRAL_SHARING_OPEN });
}
