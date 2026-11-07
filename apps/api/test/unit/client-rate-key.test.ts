import { describe, expect, it } from 'vitest';
import { clientRateKey } from '../../src/routes/client-rate-key';

describe('clientRateKey', () => {
  it('keys an IPv4 address as itself', () => {
    expect(clientRateKey({ address: '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('keys an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(clientRateKey({ address: '::ffff:203.0.113.7' })).toBe('203.0.113.7');
  });

  it('keys the hexadecimal form of an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(clientRateKey({ address: '::ffff:cb00:7107' })).toBe('203.0.113.7');
  });

  it('keys an IPv6 address by its 64-bit prefix', () => {
    expect(clientRateKey({ address: '2001:db8:1:2:3:4:5:6' })).toBe('2001:db8:1:2');
  });
});
