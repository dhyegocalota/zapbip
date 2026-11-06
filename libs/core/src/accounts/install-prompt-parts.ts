import { WHATSAPP_TEXT_MAX_CHARS } from '../inbox/constants';
import { PART_LABEL_BUDGET_CHARS } from './constants';

const SLICE_BUDGET_CHARS = WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS;
const LINE_BREAK = '\n';
const LINK_LINE_PATTERN = /https?:\/\//;

function buildLineUnits(input: { prompt: string }): string[] {
  const lines = input.prompt.split(LINE_BREAK);
  return lines.map((line, index) => (index === lines.length - 1 ? line : `${line}${LINE_BREAK}`));
}

function assertUnitFits(input: { unit: string }): void {
  if (input.unit.length <= SLICE_BUDGET_CHARS) return;
  const lineName = LINK_LINE_PATTERN.test(input.unit) ? 'link line' : 'line';
  throw new Error(`install prompt ${lineName} exceeds ${SLICE_BUDGET_CHARS} characters and cannot be split`);
}

function groupUnits(input: { units: string[] }): string[] {
  return input.units.reduce<string[]>((slices, unit) => {
    assertUnitFits({ unit });
    const lastSlice = slices[slices.length - 1];
    const fitsLastSlice = lastSlice !== undefined && lastSlice.length + unit.length <= SLICE_BUDGET_CHARS;
    if (fitsLastSlice) return [...slices.slice(0, -1), `${lastSlice}${unit}`];
    return [...slices, unit];
  }, []);
}

export function splitInstallPrompt(input: { prompt: string }): string[] {
  if (input.prompt.length === 0) throw new Error('install prompt is empty');
  const slices = groupUnits({ units: buildLineUnits({ prompt: input.prompt }) });
  return slices.map((slice, index) => `${index + 1}/${slices.length}${LINE_BREAK}${slice}`);
}
