import { describe, expect, it } from 'vitest';
import { DeployEnvironment, parseDeployEnvironment } from '../../src/operations/deploy-environment';

describe('parseDeployEnvironment', () => {
  it.each(Object.values(DeployEnvironment))('accepts %s', (value) => {
    expect(parseDeployEnvironment({ value })).toBe(value);
  });

  it('throws on an unknown environment', () => {
    expect(() => parseDeployEnvironment({ value: 'preview' })).toThrow();
  });

  it('throws on undefined', () => {
    expect(() => parseDeployEnvironment({ value: undefined })).toThrow();
  });
});
