import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { JOIN_FRAGMENT, REFERRAL_SHARING_OPEN } from '../site-constants';
import { JoinState, type PageModel } from '../page-model';
import { Notice } from './notice';
import { NoticeVariant } from '../../backoffice/backoffice-notice';

export function FinalCall(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const isJoined = model.join.state === JoinState.Joined;
  if (isJoined && !REFERRAL_SHARING_OPEN) return null;
  const buttonKey = isJoined ? SiteCopyKey.FinalButtonInvite : SiteCopyKey.FinalButton;
  return (
    <section class="block" aria-labelledby="final-title">
      <div class="container">
        <div class="final reveal">
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
              <a class="button button-primary button-arrow" href={JOIN_FRAGMENT}>
                {translate(buttonKey)}
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
