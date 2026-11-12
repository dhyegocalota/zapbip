import { describe, expect, it } from 'vitest';
import { SITE_SCRIPT } from '../../src/site/site-scripts';

describe('the scroll motion script', () => {
  it('asks the browser for scroll timelines before it falls back to the observer', () => {
    expect(SITE_SCRIPT).toContain("CSS.supports('animation-timeline: view()')");
    expect(SITE_SCRIPT).toContain('IntersectionObserver');
    expect(SITE_SCRIPT).toContain('has-reveal');
    expect(SITE_SCRIPT).toContain('is-visible');
  });

  it('never reveals under reduced motion', () => {
    expect(SITE_SCRIPT).toMatch(/reducedMotion[\s\S]*has-reveal/);
  });

  it('turns an agent card click into the hint without a reload', () => {
    expect(SITE_SCRIPT).toContain('data-picked-label');
    expect(SITE_SCRIPT).toContain('history.replaceState');
  });
});
