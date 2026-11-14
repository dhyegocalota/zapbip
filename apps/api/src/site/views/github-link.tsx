import type { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { formatCompactCount, formatCount } from '../price-format';
import { REPOSITORY_URL } from '../site-constants';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

const MARK_VIEWBOX = '0 0 16 16';
const MARK_SIZE = 16;
const MARK_PATH =
  'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';
const STAR_GLYPH = '★';
const MARK_ID = 'github-mark';

function MarkFrame(props: { children: Child }) {
  return (
    <svg class="github-mark" viewBox={MARK_VIEWBOX} width={MARK_SIZE} height={MARK_SIZE} fill="currentColor" aria-hidden="true">
      {props.children}
    </svg>
  );
}

function GitHubMarkSource() {
  return (
    <MarkFrame>
      <path id={MARK_ID} d={MARK_PATH} />
    </MarkFrame>
  );
}

export function GitHubMark() {
  return (
    <MarkFrame>
      <use href={`#${MARK_ID}`} />
    </MarkFrame>
  );
}

function StarCount(props: { count: number; locale: OwnerLocale }) {
  return (
    <span class="github-stars" aria-hidden="true">
      {STAR_GLYPH} {formatCompactCount(props)}
    </span>
  );
}

function labelOf(input: { locale: OwnerLocale; starCount: number | null }): string {
  const translate = copyOf({ locale: input.locale });
  if (input.starCount === null) return translate(SiteCopyKey.GitHubLabel);
  return translate(SiteCopyKey.GitHubStarsLabel, { stars: formatCount({ count: input.starCount, locale: input.locale }) });
}

export function GitHubButton(props: { locale: OwnerLocale; starCount: number | null }) {
  const { locale, starCount } = props;
  return (
    <a class="github-link" href={REPOSITORY_URL} rel="noopener" aria-label={labelOf({ locale, starCount })}>
      <GitHubMarkSource />
      {starCount === null ? null : <StarCount count={starCount} locale={locale} />}
    </a>
  );
}
