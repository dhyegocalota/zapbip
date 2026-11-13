import { describe, expect, it } from 'vitest';
import { SITE_STYLESHEET } from '../../src/site/site-stylesheet';

const NO_PREFERENCE_QUERY = '@media (prefers-reduced-motion: no-preference)';
const NO_PREFERENCE_WINDOW = 80;
const OBSERVER_ONLY_SELECTOR = 'html.has-reveal';
const HIDING_RULE_PATTERN = /\.(reveal|scene-step)[^{]*\{[^}]*opacity: 0;/;

function enclosingMediaQueryOf(input: { index: number }): string {
  const start = SITE_STYLESHEET.lastIndexOf('@media', input.index);
  return SITE_STYLESHEET.slice(start, start + NO_PREFERENCE_WINDOW);
}

describe('the scroll motion stylesheet', () => {
  it('never ties an animation to the scroll position, so nothing scrubs or reverses', () => {
    expect(SITE_STYLESHEET).not.toContain('animation-timeline');
    expect(SITE_STYLESHEET).not.toContain('view-timeline');
    expect(SITE_STYLESHEET).not.toContain('animation-range');
  });

  it('reveals only through the observer path, once', () => {
    expect(SITE_STYLESHEET).toContain(OBSERVER_ONLY_SELECTOR);
    expect(SITE_STYLESHEET).not.toContain('html:not(.has-reveal)');
  });

  it('pins no story to the screen', () => {
    expect(SITE_STYLESHEET).not.toContain('.why-pin');
  });

  it('hides nothing unless the script turned the observer path on', () => {
    const hidingRules = SITE_STYLESHEET.split('}').filter((rule) => HIDING_RULE_PATTERN.test(`${rule}}`));
    expect(hidingRules.length).toBeGreaterThan(0);
    expect(hidingRules.filter((rule) => !rule.includes(OBSERVER_ONLY_SELECTOR))).toEqual([]);
  });

  it('slides the idle label up and out while the awake label rises in', () => {
    expect(SITE_STYLESHEET).toMatch(
      /@keyframes scene-leave \{\s*from \{\s*opacity: 1;\s*\}\s*to \{\s*opacity: 0;\s*transform: translateY\(calc\(var\(--distance-scene\) \* -1\)\);\s*\}\s*\}/,
    );
    expect(SITE_STYLESHEET).toMatch(/\.status-text \{[^}]*overflow: hidden;/);
  });

  it('types the code in only under the no-preference query and keeps a caret off the other paths', () => {
    expect(SITE_STYLESHEET).toContain('@keyframes code-type');
    const typingIndex = SITE_STYLESHEET.indexOf('animation: code-type');
    expect(typingIndex).toBeGreaterThan(-1);
    expect(enclosingMediaQueryOf({ index: typingIndex }).startsWith(NO_PREFERENCE_QUERY)).toBe(true);
    expect(SITE_STYLESHEET).toContain('#start.is-live');
  });

  it('fades the edge of the tab row with named colours only', () => {
    expect(SITE_STYLESHEET).toMatch(/\.start-tabs \{[^}]*mask-image: linear-gradient\(/);
  });

  it('hides the typed lines only once the script has asked for it, and blinks the caret a few times', () => {
    expect(SITE_STYLESHEET).toContain('html.has-typing #start:not(.is-live)');
    expect(SITE_STYLESHEET).toMatch(/animation: caret-blink 1s steps\(1\) 5;/);
    expect(SITE_STYLESHEET).toContain('--duration-type');
  });
});
