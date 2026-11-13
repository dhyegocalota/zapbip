import type { WebLocale } from '@zapbip/types';
import { leadingAgentNames } from '../site-agents';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { AskScene, EveryAgentScene, FastScene, OfficialScene, RoutingScene, WakeScene } from './why-scenes';

const STORY_NUMBER_WIDTH = 2;
const STORY_NUMBER_PAD = '0';
const STORIES: { title: SiteCopyKey; body: SiteCopyKey; Scene: typeof OfficialScene }[] = [
  { title: SiteCopyKey.WhyOfficialTitle, body: SiteCopyKey.WhyOfficialBody, Scene: OfficialScene },
  { title: SiteCopyKey.WhyAskTitle, body: SiteCopyKey.WhyAskBody, Scene: AskScene },
  { title: SiteCopyKey.WhyRoutingTitle, body: SiteCopyKey.WhyRoutingBody, Scene: RoutingScene },
  { title: SiteCopyKey.WhyWakeTitle, body: SiteCopyKey.WhyWakeBody, Scene: WakeScene },
  { title: SiteCopyKey.WhyEveryAgentTitle, body: SiteCopyKey.WhyEveryAgentBody, Scene: EveryAgentScene },
  { title: SiteCopyKey.WhyFastTitle, body: SiteCopyKey.WhyFastBody, Scene: FastScene },
];

export function WhySection(props: { locale: WebLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="why" aria-labelledby="why-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.WhyEyebrow)}</p>
        <h2 class="section-title reveal" id="why-title">
          {translate(SiteCopyKey.WhyTitle)}
        </h2>
        <ol class="why-list">
          {STORIES.map((story, index) => (
            <li class="why-item">
              <div class="why-story">
                <div class="why-copy reveal">
                  <span class="why-number" aria-hidden="true">
                    {String(index + 1).padStart(STORY_NUMBER_WIDTH, STORY_NUMBER_PAD)}
                  </span>
                  <h3>{translate(story.title)}</h3>
                  <p>{translate(story.body, { agents: leadingAgentNames() })}</p>
                </div>
                <div class="why-visual" aria-hidden="true">
                  <story.Scene locale={props.locale} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
