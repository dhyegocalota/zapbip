import type { WebLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

const CLIPBOARD_GLYPH = '⧉';
const CHECK_GLYPH = '✓';

export function StepsSection(props: { locale: WebLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="how" aria-labelledby="how-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.HowEyebrow)}</p>
        <h2 class="section-title reveal" id="how-title">
          {translate(SiteCopyKey.HowTitle)}
        </h2>
        <ol class="steps">
          <li class="card reveal">
            <span class="step-number">{1}</span>
            <h3>{translate(SiteCopyKey.HowStepConnectTitle)}</h3>
            <p>{translate(SiteCopyKey.HowStepConnectBody)}</p>
            <span class="chip-mono" aria-hidden="true">
              {CLIPBOARD_GLYPH} {translate(SiteCopyKey.HowStepConnectVisual)}
            </span>
          </li>
          <li class="card reveal">
            <span class="step-number">{2}</span>
            <h3>{translate(SiteCopyKey.HowStepTextTitle)}</h3>
            <p>{translate(SiteCopyKey.HowStepTextBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">{translate(SiteCopyKey.HowStepTextVisualQuestion)}</span>
              <span class="pill">{translate(SiteCopyKey.HowStepTextVisualYes)}</span>
              <span class="pill">{translate(SiteCopyKey.HowStepTextVisualNo)}</span>
            </div>
          </li>
          <li class="card reveal">
            <span class="step-number">{3}</span>
            <h3>{translate(SiteCopyKey.HowStepAnswerTitle)}</h3>
            <p>{translate(SiteCopyKey.HowStepAnswerBody)}</p>
            <span class="chip-terminal" aria-hidden="true">
              <span class="accent">{CHECK_GLYPH}</span> {translate(SiteCopyKey.HowStepAnswerVisual)}
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}
