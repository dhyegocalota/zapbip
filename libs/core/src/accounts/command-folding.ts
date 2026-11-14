const ALEF_VARIANTS_PATTERN = /[آأإٱ]/g;
const ALEF = 'ا';
const ALEF_MAKSURA_PATTERN = /ى/g;
const YEH = 'ي';
const TEH_MARBUTA_PATTERN = /ة/g;
const HEH = 'ه';
const DIACRITICS_AND_TATWEEL_PATTERN = /[\u064B-\u065F\u0670\u0640]/g;
const ARABIC_QUESTION_MARK_PATTERN = /؟/g;
const QUESTION_MARK = '?';
const CHANDRABINDU_PATTERN = /\u0901/g;
const ANUSVARA = '\u0902';

export function foldCommandText(input: { text: string }): string {
  return input.text
    .replace(DIACRITICS_AND_TATWEEL_PATTERN, '')
    .replace(ALEF_VARIANTS_PATTERN, ALEF)
    .replace(ALEF_MAKSURA_PATTERN, YEH)
    .replace(TEH_MARBUTA_PATTERN, HEH)
    .replace(ARABIC_QUESTION_MARK_PATTERN, QUESTION_MARK)
    .replace(CHANDRABINDU_PATTERN, ANUSVARA);
}
