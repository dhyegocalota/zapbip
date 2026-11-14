import { OwnerLocale } from '@zapbip/types';
import { ShellTheme } from '../../src/web-shell/shell-theme';
import type { LegalDocument } from '../../src/site/legal-links';
import { JoinState, type PageModel } from '../../src/site/page-model';
import { SiteStartTab } from '../../src/site/site-agents';

export const MODEL_ORIGIN = 'https://zapbip.com';

export function pageModelFor(input: { locale: OwnerLocale; legalDocument: LegalDocument | null }): PageModel {
  return {
    locale: input.locale,
    theme: ShellTheme.System,
    siteOrigin: MODEL_ORIGIN,
    turnstileSiteKey: 'test-site-key',
    referralCode: null,
    agent: null,
    agentParameter: null,
    startTab: SiteStartTab.AnyMcp,
    join: { state: JoinState.Idle, emailValue: '' },
    legalDocument: input.legalDocument,
    starCount: null,
  };
}
