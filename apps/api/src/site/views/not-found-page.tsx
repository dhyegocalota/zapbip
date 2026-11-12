import { HttpStatus } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import type { PageModel } from '../page-model';
import { SitePath } from '../site-paths';
import { SiteLayout } from './site-layout';

export function NotFoundPage(props: { model: PageModel }) {
  const translate = copyOf({ locale: props.model.locale });
  return (
    <SiteLayout model={props.model} title={translate(SiteCopyKey.NotFoundMetaTitle)} isIndexable={false}>
      <div class="container not-found">
        <p class="error-code">{HttpStatus.NotFound}</p>
        <h1>{translate(SiteCopyKey.NotFoundTitle)}</h1>
        <a class="button button-secondary" href={SitePath.Home}>
          {translate(SiteCopyKey.NotFoundHome)}
        </a>
      </div>
    </SiteLayout>
  );
}
