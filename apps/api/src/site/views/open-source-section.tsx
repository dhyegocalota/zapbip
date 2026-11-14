import type { OwnerLocale } from '@zapbip/types';
import { REPOSITORY_SELF_HOSTING_URL, REPOSITORY_URL } from '../site-constants';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { GitHubMark } from './github-link';

export function OpenSourceSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="open-source" aria-labelledby="open-source-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.OpenSourceEyebrow)}</p>
        <h2 class="section-title reveal" id="open-source-title">
          {translate(SiteCopyKey.OpenSourceTitle)}
        </h2>
        <p class="lead reveal">{translate(SiteCopyKey.OpenSourceBody)}</p>
        <p class="source-links reveal">
          <a class="button button-primary" href={REPOSITORY_URL} rel="noopener">
            <GitHubMark />
            {translate(SiteCopyKey.OpenSourceRepository)}
          </a>
          <a class="button button-secondary button-arrow" href={REPOSITORY_SELF_HOSTING_URL} rel="noopener">
            {translate(SiteCopyKey.OpenSourceSelfHosting)}
          </a>
        </p>
      </div>
    </section>
  );
}
