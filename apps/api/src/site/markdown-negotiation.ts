const RANGE_SEPARATOR = ',';
const PARAMETER_SEPARATOR = ';';
const QUALITY_PREFIX = 'q=';
const FULL_QUALITY = 1;
const NO_QUALITY = 0;
const ANY_TYPE = '*/*';
const MARKDOWN_TYPE = 'text/markdown';
const HTML_TYPE = 'text/html';

type MediaRange = { type: string; quality: number };

function qualityOfParameter(input: { parameter: string | undefined }): number {
  const { parameter } = input;
  if (parameter === undefined) return FULL_QUALITY;
  const quality = Number(parameter.slice(QUALITY_PREFIX.length));
  return Number.isNaN(quality) ? NO_QUALITY : quality;
}

function mediaRangeOf(input: { entry: string }): MediaRange {
  const [type, ...parameters] = input.entry.split(PARAMETER_SEPARATOR).map((part) => part.trim().toLowerCase());
  const parameter = parameters.find((candidate) => candidate.startsWith(QUALITY_PREFIX));
  return { type: type!, quality: qualityOfParameter({ parameter }) };
}

function qualityOf(input: { ranges: MediaRange[]; mediaType: string }): number {
  const [group] = input.mediaType.split('/');
  const match = [input.mediaType, `${group}/*`, ANY_TYPE]
    .map((type) => input.ranges.find((range) => range.type === type))
    .find((range) => range !== undefined);
  return match === undefined ? NO_QUALITY : match.quality;
}

export function prefersMarkdown(input: { accept: string | undefined }): boolean {
  if (input.accept === undefined) return false;
  const ranges = input.accept.split(RANGE_SEPARATOR).map((entry) => mediaRangeOf({ entry }));
  return qualityOf({ ranges, mediaType: MARKDOWN_TYPE }) > qualityOf({ ranges, mediaType: HTML_TYPE });
}
