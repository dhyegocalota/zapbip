import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { JoinState, type PageModel } from '../page-model';
import { Notice } from './notice';
import { NoticeVariant } from '../../backoffice/backoffice-notice';

export function FinalCall(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const buttonKey = model.join.state === JoinState.Joined ? SiteCopyKey.FinalButtonInvite : SiteCopyKey.FinalButton;
  return (
    <section class="block" aria-labelledby="final-title">
      <div class="container">
        <div class="final hero-card">
          <h2 class="section-title" id="final-title">
            {translate(SiteCopyKey.FinalTitle)}
          </h2>
          {model.join.state === JoinState.Paused ? (
            <Notice
              variant={NoticeVariant.Warning}
              locale={model.locale}
              title={translate(SiteCopyKey.JoinPausedTitle)}
              message={translate(SiteCopyKey.JoinPausedBody)}
            />
          ) : (
            <>
              <p>{translate(SiteCopyKey.FinalBody)}</p>
              <a class="button button-primary button-arrow" href="#join">
                {translate(buttonKey)}
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
