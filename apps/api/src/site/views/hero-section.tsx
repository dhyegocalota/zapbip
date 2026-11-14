import type { OwnerLocale } from '@zapbip/types';
import { DEMO_IMAGE_SIZE, POSTER_SIZES, POSTER_SMALL_WIDTH } from '../site-constants';
import { leadingAgentNames } from '../site-agents';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { SiteAssetKind, siteAssetOf } from '../site-paths';
import type { PageModel } from '../page-model';
import { JoinBlock } from './join-block';

const UNDERLINE_PATH = 'M3 9 C 60 3, 120 13, 180 7 S 270 4, 297 8';
const UNDERLINE_VIEWBOX = '0 0 300 14';
const PAUSE_GLYPH = '❚❚';
const DEMO_STEP_KEYS = [SiteCopyKey.DemoStepAsk, SiteCopyKey.DemoStepTap, SiteCopyKey.DemoStepContinue];
const FIRST_STEP_INDEX = 0;

function DemoFigure(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  const asset = (kind: SiteAssetKind): string => siteAssetOf({ kind, locale: props.locale });
  const posterSourceSet = `${asset(SiteAssetKind.PosterSmall)} ${POSTER_SMALL_WIDTH}w, ${asset(SiteAssetKind.PosterLarge)} ${DEMO_IMAGE_SIZE}w`;
  return (
    <figure class="demo" aria-labelledby="demo-steps" aria-describedby="demo-description">
      <div class="demo-stage">
        <img
          class="demo-poster"
          src={asset(SiteAssetKind.PosterLarge)}
          srcset={posterSourceSet}
          sizes={POSTER_SIZES}
          width={DEMO_IMAGE_SIZE}
          height={DEMO_IMAGE_SIZE}
          fetchpriority="high"
          decoding="async"
          alt=""
        />
        <video class="demo-video" muted loop playsinline preload="none" width={DEMO_IMAGE_SIZE} height={DEMO_IMAGE_SIZE} aria-hidden="true">
          <source src={asset(SiteAssetKind.DemoWebm)} type="video/webm" />
          <source src={asset(SiteAssetKind.DemoMp4)} type="video/mp4" />
        </video>
        <button
          class="demo-toggle"
          type="button"
          aria-pressed="false"
          aria-label={translate(SiteCopyKey.DemoPause)}
          data-pause-label={translate(SiteCopyKey.DemoPause)}
          data-play-label={translate(SiteCopyKey.DemoPlay)}
          hidden
        >
          {PAUSE_GLYPH}
        </button>
      </div>
      <ol class="demo-steps" id="demo-steps">
        {DEMO_STEP_KEYS.map((key, index) => (
          <li aria-current={index === FIRST_STEP_INDEX ? 'step' : undefined}>{translate(key)}</li>
        ))}
      </ol>
      <p class="visually-hidden" id="demo-description">
        {translate(SiteCopyKey.DemoDescription)}
      </p>
    </figure>
  );
}

export function HeroSection(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const eyebrowKey = model.referralCode === null ? SiteCopyKey.HeroEyebrow : SiteCopyKey.HeroInvited;
  return (
    <section class="hero" id="join" aria-labelledby="hero-title">
      <div class="container">
        <div class="hero-copy">
          <p class="hero-eyebrow">
            <span class="live-dot" />
            {translate(eyebrowKey)}
          </p>
          <h1 class="hero-title" id="hero-title">
            {translate(SiteCopyKey.HeroTitleLead)}{' '}
            <span class="hero-accent">
              {translate(SiteCopyKey.HeroTitleAccent)}
              <svg class="hero-underline" viewBox={UNDERLINE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true">
                <path d={UNDERLINE_PATH} pathLength="1" />
              </svg>
            </span>
          </h1>
          <p class="hero-lead">{translate(SiteCopyKey.HeroLead, { agents: leadingAgentNames({ locale: model.locale }) })}</p>
          <JoinBlock model={model} />
        </div>
        <DemoFigure locale={model.locale} />
      </div>
    </section>
  );
}
