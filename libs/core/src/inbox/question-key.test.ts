import { describe, expect, test } from 'vitest';
import { buildQuestionKey } from './question-key';

describe('buildQuestionKey', () => {
  test('CU-59 ignores case and spacing', () => {
    const first = buildQuestionKey({ agent: 'alpha', text: 'Deploy?', optionTitles: ['Sim'] });
    const second = buildQuestionKey({ agent: 'alpha', text: ' deploy?  ', optionTitles: ['Sim'] });
    expect(first).toBe(second);
  });

  test('CU-60 differs by agent', () => {
    const first = buildQuestionKey({ agent: 'alpha', text: 'Deploy?', optionTitles: ['Sim'] });
    const second = buildQuestionKey({ agent: 'beta', text: 'Deploy?', optionTitles: ['Sim'] });
    expect(first).not.toBe(second);
  });

  test('CU-61 differs by option order', () => {
    const first = buildQuestionKey({ agent: 'alpha', text: 'Deploy?', optionTitles: ['Sim', 'Não'] });
    const second = buildQuestionKey({ agent: 'alpha', text: 'Deploy?', optionTitles: ['Não', 'Sim'] });
    expect(first).not.toBe(second);
  });

  test('normalises option titles', () => {
    const first = buildQuestionKey({ agent: 'alpha', text: 'Deploy?', optionTitles: ['Sim'] });
    const second = buildQuestionKey({ agent: 'alpha', text: 'Deploy?', optionTitles: ['  SIM '] });
    expect(first).toBe(second);
  });
});
