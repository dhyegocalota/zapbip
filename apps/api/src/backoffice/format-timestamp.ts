const ISO_MINUTE_LENGTH = 16;
const TIMESTAMP_SUFFIX = ' UTC';
const DATE_TIME_SEPARATOR = 'T';
const DISPLAY_SEPARATOR = ' ';

export function formatTimestamp(input: { at: number }): string {
  const isoMinute = new Date(input.at).toISOString().slice(0, ISO_MINUTE_LENGTH);
  return `${isoMinute.replace(DATE_TIME_SEPARATOR, DISPLAY_SEPARATOR)}${TIMESTAMP_SUFFIX}`;
}
